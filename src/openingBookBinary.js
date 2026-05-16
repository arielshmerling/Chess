/**
 * On-disk opening book: binary container (raw compact state/move buffers, no base64 on disk).
 *
 * ## File signature (“magic”)
 * The first 4 bytes must be ASCII `OBBK` (Opening Book Binary). That lets readers reject
 * wrong files (e.g. a raw build stream or an old JSON artifact) before parsing payloads.
 *
 * ## Layout
 * - 4 bytes file magic `OBBK`
 * - 4 bytes container version (uint32 BE), currently 1
 * - 4 bytes entryCount (uint32 BE)
 * - 4 bytes metadataByteLength (uint32 BE)
 * - metadataByteLength bytes UTF-8 (`generatedAt` ISO timestamp)
 * - entries: repeat entryCount times {
 *     u32 stateByteLength BE, state bytes,
 *     u32 moveByteLength BE, move bytes
 *   }
 *
 * State/move payloads use {@link gameStateCompact} / {@link gameMoveCompact} (each has its own magic).
 */

const fs = require("fs").promises;
const path = require("path");

/** ASCII bytes for `OBBK` — identifies a finalized opening-book file. */
const FILE_MAGIC = Buffer.from([0x4f, 0x42, 0x42, 0x4b]);
const UINT32_BYTE_LENGTH = 4;
const FILE_HEADER_FIXED_BYTE_LENGTH = FILE_MAGIC.length + UINT32_BYTE_LENGTH + UINT32_BYTE_LENGTH + UINT32_BYTE_LENGTH;
/** Reject obviously corrupt length fields when scanning build streams. */
const MAX_SANE_PAYLOAD_BYTES = 1e9;

/** Binary file container version (not the SC/SM codec versions inside each buffer). */
exports.CONTAINER_VERSION = 1;
exports.MAGIC = FILE_MAGIC;
exports.MAGIC_LENGTH = FILE_MAGIC.length;

/**
 * @param {number} value
 * @returns {Buffer}
 */
function writeUInt32BigEndian(value) {
    const lengthPrefix = Buffer.alloc(UINT32_BYTE_LENGTH);
    lengthPrefix.writeUInt32BE(value >>> 0, 0);
    return lengthPrefix;
}

/**
 * One build-stream record: state length + state bytes + move length + move bytes.
 * @param {Buffer} stateBuf
 * @param {Buffer} moveBuf
 * @returns {Buffer}
 */
function encodeBuildRecord(stateBuf, moveBuf) {
    return Buffer.concat([
        writeUInt32BigEndian(stateBuf.length),
        stateBuf,
        writeUInt32BigEndian(moveBuf.length),
        moveBuf,
    ]);
}

exports.encodeBuildRecord = encodeBuildRecord;

/**
 * @param {string} buildPath
 * @param {Buffer} stateBuf
 * @param {Buffer} moveBuf
 */
exports.appendBuildRecord = async (buildPath, stateBuf, moveBuf) => {
    await fs.appendFile(buildPath, encodeBuildRecord(stateBuf, moveBuf));
};

/**
 * @param {Buffer} buffer
 * @param {number} offset
 * @returns {{ stateBuf: Buffer, moveBuf: Buffer, nextOffset: number }|null} null if record is incomplete
 */
function tryReadBuildRecordAtOffset(buffer, offset) {
    const minimumPrefixBytes = UINT32_BYTE_LENGTH + UINT32_BYTE_LENGTH;
    if (offset + minimumPrefixBytes > buffer.length) {
        return null;
    }
    const stateByteLength = buffer.readUInt32BE(offset);
    if (stateByteLength > MAX_SANE_PAYLOAD_BYTES) {
        return null;
    }
    let readOffset = offset + UINT32_BYTE_LENGTH;
    if (readOffset + stateByteLength + UINT32_BYTE_LENGTH > buffer.length) {
        return null;
    }
    const stateBuf = buffer.subarray(readOffset, readOffset + stateByteLength);
    readOffset += stateByteLength;
    const moveByteLength = buffer.readUInt32BE(readOffset);
    if (moveByteLength > MAX_SANE_PAYLOAD_BYTES) {
        return null;
    }
    readOffset += UINT32_BYTE_LENGTH;
    if (readOffset + moveByteLength > buffer.length) {
        return null;
    }
    const moveBuf = buffer.subarray(readOffset, readOffset + moveByteLength);
    readOffset += moveByteLength;
    return { stateBuf, moveBuf, nextOffset: readOffset };
}

/**
 * @param {Buffer} buffer
 * @returns {number}
 */
function countBuildFormatRecordsInBuffer(buffer) {
    let offset = 0;
    let recordCount = 0;
    while (offset < buffer.length) {
        const record = tryReadBuildRecordAtOffset(buffer, offset);
        if (!record) {
            break;
        }
        offset = record.nextOffset;
        recordCount++;
    }
    return recordCount;
}

/**
 * Writes a valid OBBK container: header `entryCount` always matches complete records in the build file.
 * Writes to a temp file in the same directory, then renames over `outputPath`, so the previous book
 * remains intact if finalize fails mid-write.
 *
 * @param {{ buildPath: string, outputPath: string, generatedAt: string, entryCount?: number }} opts
 * `entryCount` is optional metadata for mismatch logging; the on-disk count is taken from `buildPath`.
 */
exports.finalizeBinaryFile = async ({ buildPath, outputPath, generatedAt, entryCount: declaredEntryCount }) => {
    const buildBody = await fs.readFile(buildPath);
    const entryCountFromBody = countBuildFormatRecordsInBuffer(buildBody);
    if (
        declaredEntryCount != null
        && declaredEntryCount !== entryCountFromBody
    ) {
        console.warn(
            `[opening book] Declared entryCount ${declaredEntryCount} does not match build file (${entryCountFromBody}); using build file.`,
        );
    }
    const entryCountForHeader = entryCountFromBody;
    const metadataBytes = Buffer.from(String(generatedAt), "utf8");
    const header = Buffer.alloc(FILE_HEADER_FIXED_BYTE_LENGTH + metadataBytes.length);
    let headerWriteOffset = 0;
    FILE_MAGIC.copy(header, headerWriteOffset);
    headerWriteOffset += FILE_MAGIC.length;
    header.writeUInt32BE(exports.CONTAINER_VERSION, headerWriteOffset);
    headerWriteOffset += UINT32_BYTE_LENGTH;
    header.writeUInt32BE(entryCountForHeader >>> 0, headerWriteOffset);
    headerWriteOffset += UINT32_BYTE_LENGTH;
    header.writeUInt32BE(metadataBytes.length, headerWriteOffset);
    headerWriteOffset += UINT32_BYTE_LENGTH;
    metadataBytes.copy(header, headerWriteOffset);
    const finalizedFileBuffer = Buffer.concat([header, buildBody]);
    const outputDirectory = path.dirname(outputPath);
    const tempFileName = `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`;
    const tempFilePath = path.join(outputDirectory, tempFileName);
    try {
        await fs.writeFile(tempFilePath, finalizedFileBuffer);
        await fs.rename(tempFilePath, outputPath);
    } catch (writeError) {
        await fs.unlink(tempFilePath).catch(() => {});
        throw writeError;
    }
    return entryCountForHeader;
};

/**
 * @param {string} filePath
 * @returns {Promise<number|null>} entryCount if this path is a valid binary book, else null
 */
exports.readEntryCountFromBinaryHeader = async (filePath) => {
    let fileHandle;
    try {
        fileHandle = await fs.open(filePath, "r");
    } catch (openError) {
        if (openError && openError.code === "ENOENT") {
            return null;
        }
        throw openError;
    }
    try {
        const headerPrefix = Buffer.alloc(12);
        const { bytesRead } = await fileHandle.read(headerPrefix, 0, 12, 0);
        if (bytesRead < 12 || headerPrefix.subarray(0, 4).compare(FILE_MAGIC) !== 0) {
            return null;
        }
        const entryCountFromHeader = headerPrefix.readUInt32BE(8);
        return Number.isFinite(entryCountFromHeader) && entryCountFromHeader >= 0 ? entryCountFromHeader : null;
    } finally {
        await fileHandle.close();
    }
};

/**
 * Parses an in-progress build file produced by {@link appendBuildRecord} (length-prefixed pairs only, no header).
 * Trailing incomplete bytes (e.g. interrupted write) are ignored.
 * @param {Buffer} buildFileBuffer
 * @returns {{ stateBuf: Buffer, moveBuf: Buffer }[]}
 */
exports.parseBuildFileBuffer = (buildFileBuffer) => {
    const records = [];
    let offset = 0;
    while (offset < buildFileBuffer.length) {
        const record = tryReadBuildRecordAtOffset(buildFileBuffer, offset);
        if (!record) {
            break;
        }
        records.push({ stateBuf: record.stateBuf, moveBuf: record.moveBuf });
        offset = record.nextOffset;
    }
    return records;
};

/**
 * Counts records in a build file without loading the whole file into memory.
 * @param {string} filePath
 * @returns {Promise<number>}
 */
exports.countBuildFormatRecordsFromPath = async (filePath) => {
    const fileHandle = await fs.open(filePath, "r");
    let pendingBytes = Buffer.alloc(0);
    const readChunkSize = 2 * 1024 * 1024;
    let recordCount = 0;
    try {
        for (;;) {
            const readChunk = Buffer.alloc(readChunkSize);
            const { bytesRead } = await fileHandle.read(readChunk, 0, readChunkSize, null);
            if (bytesRead > 0) {
                pendingBytes = pendingBytes.length
                    ? Buffer.concat([pendingBytes, readChunk.subarray(0, bytesRead)])
                    : readChunk.subarray(0, bytesRead);
            }
            let scanOffset = 0;
            while (scanOffset + UINT32_BYTE_LENGTH <= pendingBytes.length) {
                const record = tryReadBuildRecordAtOffset(pendingBytes, scanOffset);
                if (!record) {
                    break;
                }
                scanOffset = record.nextOffset;
                recordCount++;
            }
            pendingBytes = pendingBytes.subarray(scanOffset);
            if (bytesRead === 0) {
                break;
            }
        }
    } finally {
        await fileHandle.close();
    }
    return recordCount;
};

/**
 * @param {Buffer} fileBuffer full file
 * @returns {{ stateBuf: Buffer, moveBuf: Buffer }[]}
 */
exports.parseBinaryFileBuffer = (fileBuffer) => {
    if (!fileBuffer || fileBuffer.length < FILE_HEADER_FIXED_BYTE_LENGTH) {
        throw new Error("opening book: file too small");
    }
    if (fileBuffer.subarray(0, 4).compare(FILE_MAGIC) !== 0) {
        throw new Error("opening book: bad magic");
    }
    let readOffset = FILE_MAGIC.length;
    const containerVersion = fileBuffer.readUInt32BE(readOffset);
    readOffset += UINT32_BYTE_LENGTH;
    if (containerVersion !== exports.CONTAINER_VERSION) {
        throw new Error(`opening book: unsupported container version ${containerVersion}`);
    }
    const entryCountFromHeader = fileBuffer.readUInt32BE(readOffset);
    readOffset += UINT32_BYTE_LENGTH;
    const metadataByteLength = fileBuffer.readUInt32BE(readOffset);
    readOffset += UINT32_BYTE_LENGTH;
    if (fileBuffer.length < readOffset + metadataByteLength) {
        throw new Error("opening book: truncated meta");
    }
    readOffset += metadataByteLength;

    const records = [];
    while (readOffset < fileBuffer.length) {
        const record = tryReadBuildRecordAtOffset(fileBuffer, readOffset);
        if (!record) {
            throw new Error("opening book: truncated record");
        }
        records.push({ stateBuf: record.stateBuf, moveBuf: record.moveBuf });
        readOffset = record.nextOffset;
    }

    if (records.length !== entryCountFromHeader) {
        console.warn(`[opening book] header entryCount ${entryCountFromHeader} vs records parsed ${records.length}`);
    }
    return records;
};
