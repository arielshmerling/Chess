#!/usr/bin/env node
/**
 * Sync missing English keys into all shipped locale catalogs.
 * Source of truth: en.js / en-extra.js. Preserves {{param}} placeholders.
 *
 * Usage: node scripts/i18n-sync-missing.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src", "strings");
const LOCALES = ["he", "fr", "de", "es", "ar", "zh", "ja", "hi", "ru", "uk", "no"];

/** @type {Record<string, object>} */
const BY_LOCALE = {
    he: {
        shellChat: {
            chat: "צ'אט",
            expandChatPanel: "הרחב את חלונית הצ'אט",
            collapseChatPanel: "כווץ את חלונית הצ'אט",
            chatPlaceholder: "הקלד הודעה…",
            chatWatcherReadonly: "צופים יכולים רק לקרוא את הצ'אט",
            sendChat: "שלח",
        },
        newGamePrivate: {
            private: "פרטי",
            privateHint: "משחקים פרטיים אינם מוצגים ברשימות המשחקים הפעילים של חברים אחרים.",
        },
        playNowPrivateHint: "משחקים פרטיים אינם מוצגים ברשימות המשחקים הפעילים של חברים אחרים.",
        closePreferences: "סגור העדפות",
        footer: {
            logoAlt: "שחמט שמרלינג",
            navAria: "כותרת תחתונה",
            privacy: "מדיניות פרטיות",
            terms: "תנאי שימוש",
            contact: "צור קשר",
            copyright: "© {{year}} שחמט שמרלינג. כל הזכויות שמורות.",
            lastUpdated: "עודכן לאחרונה: {{date}}",
            privacyTitle: "מדיניות פרטיות",
            privacyLead: "כיצד שחמט שמרלינג מטפל בפרטי חשבון ובמידע משחק.",
            privacyBody:
                "אנו משתמשים בפרטי החשבון שלך להפעלת השירות, לשמירת משחקים והעדפות ולשיפור המוצר. איננו מוכרים מידע אישי. נוסח המדיניות המלא יפורסם כאן.",
            termsTitle: "תנאי שימוש",
            termsLead: "הכללים לשימוש בשחמט שמרלינג.",
            termsBody:
                "בשימוש בשחמט שמרלינג אתה מסכים לשחק בהגינות, לכבד שחקנים אחרים ולהשתמש בשירות למשחק שחמט אישי בלבד. התנאים המלאים יפורסמו כאן.",
            contactTitle: "צור קשר",
            contactLead: "צור קשר עם צוות שחמט שמרלינג.",
            contactBody: "פרטי קשר לתמיכה ולשאלות פרטיות יפורסמו כאן.",
        },
        errorPage: {
            code: "שגיאה {{code}}",
            notFoundTitle: "הדף לא נמצא",
            notFoundMessage: "הדף שחיפשת אינו קיים.",
            genericTitle: "משהו השתבש",
            genericMessage: "אירעה שגיאה בלתי צפויה. אנא נסה שוב.",
            backHome: "חזרה לבית",
        },
    },
    fr: {
        shellChat: {
            chat: "Discussion",
            expandChatPanel: "Développer le panneau de discussion",
            collapseChatPanel: "Réduire le panneau de discussion",
            chatPlaceholder: "Écrire un message…",
            chatWatcherReadonly: "Les spectateurs peuvent seulement lire la discussion",
            sendChat: "Envoyer",
        },
        newGamePrivate: {
            private: "Privée",
            privateHint:
                "Les parties privées n’apparaissent pas dans les listes de parties actives des autres membres.",
        },
        playNowPrivateHint:
            "Les parties privées n’apparaissent pas dans les listes de parties actives des autres membres.",
        closePreferences: "Fermer les préférences",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Pied de page",
            privacy: "Politique de confidentialité",
            terms: "Conditions d’utilisation",
            contact: "Contact",
            copyright: "© {{year}} Shmerling Chess. Tous droits réservés.",
            lastUpdated: "Dernière mise à jour : {{date}}",
            privacyTitle: "Politique de confidentialité",
            privacyLead: "Comment Shmerling Chess traite les informations de compte et de partie.",
            privacyBody:
                "Nous utilisons vos données de compte pour faire fonctionner le service, conserver les parties et préférences, et améliorer le produit. Nous ne vendons pas d’informations personnelles. Le texte complet de la politique sera publié ici.",
            termsTitle: "Conditions d’utilisation",
            termsLead: "Les règles d’utilisation de Shmerling Chess.",
            termsBody:
                "En utilisant Shmerling Chess, vous acceptez de jouer loyalement, de respecter les autres joueurs et d’utiliser le service uniquement pour le jeu d’échecs personnel. Les conditions complètes seront publiées ici.",
            contactTitle: "Contact",
            contactLead: "Contacter l’équipe Shmerling Chess.",
            contactBody:
                "Les coordonnées pour le support et les questions de confidentialité seront publiées ici.",
        },
        errorPage: {
            code: "Erreur {{code}}",
            notFoundTitle: "Page introuvable",
            notFoundMessage: "La page que vous recherchez n’existe pas.",
            genericTitle: "Une erreur s’est produite",
            genericMessage: "Une erreur inattendue s’est produite. Veuillez réessayer.",
            backHome: "Retour à l’accueil",
        },
    },
    de: {
        shellChat: {
            chat: "Chat",
            expandChatPanel: "Chat-Bereich erweitern",
            collapseChatPanel: "Chat-Bereich einklappen",
            chatPlaceholder: "Nachricht eingeben…",
            chatWatcherReadonly: "Zuschauer können den Chat nur lesen",
            sendChat: "Senden",
        },
        newGamePrivate: {
            private: "Privat",
            privateHint:
                "Private Partien werden nicht in den Aktive-Partien-Listen anderer Mitglieder angezeigt.",
        },
        playNowPrivateHint:
            "Private Partien werden nicht in den Aktive-Partien-Listen anderer Mitglieder angezeigt.",
        closePreferences: "Einstellungen schließen",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Fußzeile",
            privacy: "Datenschutzrichtlinie",
            terms: "Nutzungsbedingungen",
            contact: "Kontakt",
            copyright: "© {{year}} Shmerling Chess. Alle Rechte vorbehalten.",
            lastUpdated: "Zuletzt aktualisiert: {{date}}",
            privacyTitle: "Datenschutzrichtlinie",
            privacyLead: "Wie Shmerling Chess Konto- und Spieldaten verarbeitet.",
            privacyBody:
                "Wir verwenden Ihre Kontodaten, um den Dienst zu betreiben, Partien und Einstellungen zu speichern und das Produkt zu verbessern. Wir verkaufen keine personenbezogenen Daten. Der vollständige Richtlinientext wird hier veröffentlicht.",
            termsTitle: "Nutzungsbedingungen",
            termsLead: "Die Regeln für die Nutzung von Shmerling Chess.",
            termsBody:
                "Mit der Nutzung von Shmerling Chess verpflichten Sie sich, fair zu spielen, andere Spieler zu respektieren und den Dienst nur für persönliches Schachspiel zu verwenden. Die vollständigen Bedingungen werden hier veröffentlicht.",
            contactTitle: "Kontakt",
            contactLead: "Kontakt zum Shmerling-Chess-Team.",
            contactBody:
                "Kontaktdaten für Support und Datenschutzfragen werden hier veröffentlicht.",
        },
        errorPage: {
            code: "Fehler {{code}}",
            notFoundTitle: "Seite nicht gefunden",
            notFoundMessage: "Die gesuchte Seite existiert nicht.",
            genericTitle: "Etwas ist schiefgelaufen",
            genericMessage: "Ein unerwarteter Fehler ist aufgetreten. Bitte erneut versuchen.",
            backHome: "Zurück zur Startseite",
        },
    },
    es: {
        shellChat: {
            chat: "Chat",
            expandChatPanel: "Expandir el panel de chat",
            collapseChatPanel: "Contraer el panel de chat",
            chatPlaceholder: "Escribe un mensaje…",
            chatWatcherReadonly: "Los espectadores solo pueden leer el chat",
            sendChat: "Enviar",
        },
        newGamePrivate: {
            private: "Privada",
            privateHint:
                "Las partidas privadas no se muestran en las listas de partidas activas de otros miembros.",
        },
        playNowPrivateHint:
            "Las partidas privadas no se muestran en las listas de partidas activas de otros miembros.",
        closePreferences: "Cerrar preferencias",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Pie de página",
            privacy: "Política de privacidad",
            terms: "Términos de uso",
            contact: "Contacto",
            copyright: "© {{year}} Shmerling Chess. Todos los derechos reservados.",
            lastUpdated: "Última actualización: {{date}}",
            privacyTitle: "Política de privacidad",
            privacyLead: "Cómo Shmerling Chess trata la información de cuenta y de juego.",
            privacyBody:
                "Usamos los datos de tu cuenta para operar el servicio, guardar partidas y preferencias, y mejorar el producto. No vendemos información personal. El texto completo de la política se publicará aquí.",
            termsTitle: "Términos de uso",
            termsLead: "Las reglas para usar Shmerling Chess.",
            termsBody:
                "Al usar Shmerling Chess aceptas jugar con fair play, respetar a otros jugadores y usar el servicio solo para ajedrez personal. Los términos completos se publicarán aquí.",
            contactTitle: "Contacto",
            contactLead: "Ponte en contacto con el equipo de Shmerling Chess.",
            contactBody:
                "Los datos de contacto para soporte y privacidad se publicarán aquí.",
        },
        errorPage: {
            code: "Error {{code}}",
            notFoundTitle: "Página no encontrada",
            notFoundMessage: "La página que buscas no existe.",
            genericTitle: "Algo salió mal",
            genericMessage: "Ocurrió un error inesperado. Inténtalo de nuevo.",
            backHome: "Volver al inicio",
        },
    },
    ar: {
        shellChat: {
            chat: "دردشة",
            expandChatPanel: "توسيع لوحة الدردشة",
            collapseChatPanel: "طي لوحة الدردشة",
            chatPlaceholder: "اكتب رسالة…",
            chatWatcherReadonly: "يمكن للمشاهدين قراءة الدردشة فقط",
            sendChat: "إرسال",
        },
        newGamePrivate: {
            private: "خاصة",
            privateHint: "لا تظهر الألعاب الخاصة في قوائم الألعاب النشطة للأعضاء الآخرين.",
        },
        playNowPrivateHint: "لا تظهر الألعاب الخاصة في قوائم الألعاب النشطة للأعضاء الآخرين.",
        closePreferences: "إغلاق التفضيلات",
        footer: {
            logoAlt: "شطرنج شمرلينغ",
            navAria: "تذييل الصفحة",
            privacy: "سياسة الخصوصية",
            terms: "شروط الاستخدام",
            contact: "اتصل بنا",
            copyright: "© {{year}} شطرنج شمرلينغ. جميع الحقوق محفوظة.",
            lastUpdated: "آخر تحديث: {{date}}",
            privacyTitle: "سياسة الخصوصية",
            privacyLead: "كيف يتعامل شطرنج شمرلينغ مع معلومات الحساب واللعب.",
            privacyBody:
                "نستخدم تفاصيل حسابك لتشغيل الخدمة وحفظ الألعاب والتفضيلات وتحسين المنتج. لا نبيع المعلومات الشخصية. سيُنشر نص السياسة الكامل هنا.",
            termsTitle: "شروط الاستخدام",
            termsLead: "قواعد استخدام شطرنج شمرلينغ.",
            termsBody:
                "باستخدام شطرنج شمرلينغ فإنك توافق على اللعب بنزاهة واحترام اللاعبين الآخرين واستخدام الخدمة للشطرنج الشخصي فقط. ستُنشر الشروط الكاملة هنا.",
            contactTitle: "اتصل بنا",
            contactLead: "تواصل مع فريق شطرنج شمرلينغ.",
            contactBody: "ستُنشر تفاصيل الاتصال للدعم وأسئلة الخصوصية هنا.",
        },
        errorPage: {
            code: "خطأ {{code}}",
            notFoundTitle: "الصفحة غير موجودة",
            notFoundMessage: "الصفحة التي تبحث عنها غير موجودة.",
            genericTitle: "حدث خطأ ما",
            genericMessage: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
            backHome: "العودة إلى الصفحة الرئيسية",
        },
    },
    zh: {
        shellChat: {
            chat: "聊天",
            expandChatPanel: "展开聊天面板",
            collapseChatPanel: "收起聊天面板",
            chatPlaceholder: "输入消息…",
            chatWatcherReadonly: "观众只能阅读聊天",
            sendChat: "发送",
        },
        newGamePrivate: {
            private: "私人",
            privateHint: "私人对局不会显示在其他会员的进行中对局列表中。",
        },
        playNowPrivateHint: "私人对局不会显示在其他会员的进行中对局列表中。",
        closePreferences: "关闭偏好设置",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "页脚",
            privacy: "隐私政策",
            terms: "使用条款",
            contact: "联系我们",
            copyright: "© {{year}} Shmerling Chess。保留所有权利。",
            lastUpdated: "最后更新：{{date}}",
            privacyTitle: "隐私政策",
            privacyLead: "Shmerling Chess 如何处理账户与对局信息。",
            privacyBody:
                "我们使用您的账户信息来运营服务、保存对局与偏好并改进产品。我们不会出售个人信息。完整政策文本将在此发布。",
            termsTitle: "使用条款",
            termsLead: "使用 Shmerling Chess 的规则。",
            termsBody:
                "使用 Shmerling Chess 即表示您同意公平对弈、尊重其他玩家，并仅将服务用于个人国际象棋对局。完整条款将在此发布。",
            contactTitle: "联系我们",
            contactLead: "联系 Shmerling Chess 团队。",
            contactBody: "支持与隐私问题的联系方式将在此发布。",
        },
        errorPage: {
            code: "错误 {{code}}",
            notFoundTitle: "页面未找到",
            notFoundMessage: "您要查找的页面不存在。",
            genericTitle: "出了点问题",
            genericMessage: "发生了意外错误。请重试。",
            backHome: "返回首页",
        },
    },
    ja: {
        shellChat: {
            chat: "チャット",
            expandChatPanel: "チャットパネルを展開",
            collapseChatPanel: "チャットパネルを折りたたむ",
            chatPlaceholder: "メッセージを入力…",
            chatWatcherReadonly: "観戦者はチャットを読むだけです",
            sendChat: "送信",
        },
        newGamePrivate: {
            private: "非公開",
            privateHint: "非公開の対局は、他のメンバーの進行中の対局一覧には表示されません。",
        },
        playNowPrivateHint: "非公開の対局は、他のメンバーの進行中の対局一覧には表示されません。",
        closePreferences: "設定を閉じる",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "フッター",
            privacy: "プライバシーポリシー",
            terms: "利用規約",
            contact: "お問い合わせ",
            copyright: "© {{year}} Shmerling Chess. All rights reserved.",
            lastUpdated: "最終更新: {{date}}",
            privacyTitle: "プライバシーポリシー",
            privacyLead: "Shmerling Chess がアカウントと対局情報を扱う方法。",
            privacyBody:
                "サービス運営、対局と設定の保存、製品改善のためにアカウント情報を使用します。個人情報は販売しません。正式なポリシー本文はここに掲載されます。",
            termsTitle: "利用規約",
            termsLead: "Shmerling Chess の利用ルール。",
            termsBody:
                "Shmerling Chess を利用することで、公正に対戦し、他のプレイヤーを尊重し、個人のチェス対局のみにサービスを使うことに同意したものとします。正式な規約はここに掲載されます。",
            contactTitle: "お問い合わせ",
            contactLead: "Shmerling Chess チームへの連絡。",
            contactBody: "サポートとプライバシーに関する連絡先はここに掲載されます。",
        },
        errorPage: {
            code: "エラー {{code}}",
            notFoundTitle: "ページが見つかりません",
            notFoundMessage: "お探しのページは存在しません。",
            genericTitle: "問題が発生しました",
            genericMessage: "予期しないエラーが発生しました。もう一度お試しください。",
            backHome: "ホームに戻る",
        },
    },
    hi: {
        shellChat: {
            chat: "चैट",
            expandChatPanel: "चैट पैनल विस्तारित करें",
            collapseChatPanel: "चैट पैनल संक्षिप्त करें",
            chatPlaceholder: "संदेश लिखें…",
            chatWatcherReadonly: "दर्शक केवल चैट पढ़ सकते हैं",
            sendChat: "भेजें",
        },
        newGamePrivate: {
            private: "निजी",
            privateHint: "निजी खेल अन्य सदस्यों की सक्रिय खेल सूचियों में नहीं दिखते।",
        },
        playNowPrivateHint: "निजी खेल अन्य सदस्यों की सक्रिय खेल सूचियों में नहीं दिखते।",
        closePreferences: "वरीयताएँ बंद करें",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "फुटर",
            privacy: "गोपनीयता नीति",
            terms: "उपयोग की शर्तें",
            contact: "संपर्क",
            copyright: "© {{year}} Shmerling Chess. सर्वाधिकार सुरक्षित।",
            lastUpdated: "अंतिम अपडेट: {{date}}",
            privacyTitle: "गोपनीयता नीति",
            privacyLead: "Shmerling Chess खाता और गेमप्ले जानकारी को कैसे संभालता है।",
            privacyBody:
                "हम सेवा चलाने, खेल और प्राथमिकताएँ रखने तथा उत्पाद सुधारने के लिए आपके खाते का विवरण उपयोग करते हैं। हम व्यक्तिगत जानकारी नहीं बेचते। पूरी नीति यहाँ प्रकाशित की जाएगी।",
            termsTitle: "उपयोग की शर्तें",
            termsLead: "Shmerling Chess उपयोग करने के नियम।",
            termsBody:
                "Shmerling Chess का उपयोग करके आप निष्पक्ष खेलने, अन्य खिलाड़ियों का सम्मान करने और सेवा केवल व्यक्तिगत शतरंज के लिए उपयोग करने पर सहमत होते हैं। पूरी शर्तें यहाँ प्रकाशित की जाएँगी।",
            contactTitle: "संपर्क",
            contactLead: "Shmerling Chess टीम से संपर्क करें।",
            contactBody: "सहायता और गोपनीयता प्रश्नों के संपर्क विवरण यहाँ प्रकाशित किए जाएँगे।",
        },
        errorPage: {
            code: "त्रुटि {{code}}",
            notFoundTitle: "पृष्ठ नहीं मिला",
            notFoundMessage: "आप जिस पृष्ठ को खोज रहे हैं वह मौजूद नहीं है।",
            genericTitle: "कुछ गलत हो गया",
            genericMessage: "एक अप्रत्याशित त्रुटि हुई। कृपया फिर से प्रयास करें।",
            backHome: "होम पर वापस जाएँ",
        },
    },
    ru: {
        shellChat: {
            chat: "Чат",
            expandChatPanel: "Развернуть панель чата",
            collapseChatPanel: "Свернуть панель чата",
            chatPlaceholder: "Введите сообщение…",
            chatWatcherReadonly: "Зрители могут только читать чат",
            sendChat: "Отправить",
        },
        newGamePrivate: {
            private: "Приватная",
            privateHint:
                "Приватные партии не отображаются в списках активных партий других участников.",
        },
        playNowPrivateHint:
            "Приватные партии не отображаются в списках активных партий других участников.",
        closePreferences: "Закрыть настройки",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Подвал",
            privacy: "Политика конфиденциальности",
            terms: "Условия использования",
            contact: "Контакты",
            copyright: "© {{year}} Shmerling Chess. Все права защищены.",
            lastUpdated: "Последнее обновление: {{date}}",
            privacyTitle: "Политика конфиденциальности",
            privacyLead: "Как Shmerling Chess обрабатывает данные аккаунта и партий.",
            privacyBody:
                "Мы используем данные вашего аккаунта для работы сервиса, хранения партий и настроек и улучшения продукта. Мы не продаём персональные данные. Полный текст политики будет опубликован здесь.",
            termsTitle: "Условия использования",
            termsLead: "Правила использования Shmerling Chess.",
            termsBody:
                "Используя Shmerling Chess, вы соглашаетесь играть честно, уважать других игроков и использовать сервис только для личной игры в шахматы. Полные условия будут опубликованы здесь.",
            contactTitle: "Контакты",
            contactLead: "Свяжитесь с командой Shmerling Chess.",
            contactBody:
                "Контактные данные для поддержки и вопросов о конфиденциальности будут опубликованы здесь.",
        },
        errorPage: {
            code: "Ошибка {{code}}",
            notFoundTitle: "Страница не найдена",
            notFoundMessage: "Запрашиваемая страница не существует.",
            genericTitle: "Что-то пошло не так",
            genericMessage: "Произошла непредвиденная ошибка. Попробуйте ещё раз.",
            backHome: "На главную",
        },
    },
    uk: {
        shellChat: {
            chat: "Чат",
            expandChatPanel: "Розгорнути панель чату",
            collapseChatPanel: "Згорнути панель чату",
            chatPlaceholder: "Введіть повідомлення…",
            chatWatcherReadonly: "Глядачі можуть лише читати чат",
            sendChat: "Надіслати",
        },
        newGamePrivate: {
            private: "Приватна",
            privateHint:
                "Приватні партії не відображаються в списках активних партій інших учасників.",
        },
        playNowPrivateHint:
            "Приватні партії не відображаються в списках активних партій інших учасників.",
        closePreferences: "Закрити налаштування",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Підвал",
            privacy: "Політика конфіденційності",
            terms: "Умови використання",
            contact: "Контакти",
            copyright: "© {{year}} Shmerling Chess. Усі права захищено.",
            lastUpdated: "Останнє оновлення: {{date}}",
            privacyTitle: "Політика конфіденційності",
            privacyLead: "Як Shmerling Chess обробляє дані облікового запису та партій.",
            privacyBody:
                "Ми використовуємо дані вашого облікового запису для роботи сервісу, збереження партій і налаштувань та покращення продукту. Ми не продаємо персональні дані. Повний текст політики буде опубліковано тут.",
            termsTitle: "Умови використання",
            termsLead: "Правила користування Shmerling Chess.",
            termsBody:
                "Використовуючи Shmerling Chess, ви погоджуєтеся грати чесно, поважати інших гравців і використовувати сервіс лише для особистої гри в шахи. Повні умови буде опубліковано тут.",
            contactTitle: "Контакти",
            contactLead: "Зв’яжіться з командою Shmerling Chess.",
            contactBody:
                "Контактні дані для підтримки та питань конфіденційності буде опубліковано тут.",
        },
        errorPage: {
            code: "Помилка {{code}}",
            notFoundTitle: "Сторінку не знайдено",
            notFoundMessage: "Сторінки, яку ви шукаєте, не існує.",
            genericTitle: "Щось пішло не так",
            genericMessage: "Сталася неочікувана помилка. Спробуйте ще раз.",
            backHome: "На головну",
        },
    },
    no: {
        shellChat: {
            chat: "Chat",
            expandChatPanel: "Utvid chat-panelet",
            collapseChatPanel: "Skjul chat-panelet",
            chatPlaceholder: "Skriv en melding…",
            chatWatcherReadonly: "Tilskuere kan bare lese chatten",
            sendChat: "Send",
        },
        newGamePrivate: {
            private: "Privat",
            privateHint:
                "Private partier vises ikke i andre medlemmers lister over aktive partier.",
        },
        playNowPrivateHint:
            "Private partier vises ikke i andre medlemmers lister over aktive partier.",
        closePreferences: "Lukk innstillinger",
        footer: {
            logoAlt: "Shmerling Chess",
            navAria: "Bunntekst",
            privacy: "Personvernerklæring",
            terms: "Bruksvilkår",
            contact: "Kontakt",
            copyright: "© {{year}} Shmerling Chess. Alle rettigheter forbeholdt.",
            lastUpdated: "Sist oppdatert: {{date}}",
            privacyTitle: "Personvernerklæring",
            privacyLead: "Hvordan Shmerling Chess behandler konto- og spillinformasjon.",
            privacyBody:
                "Vi bruker kontodetaljene dine for å drive tjenesten, lagre partier og preferanser, og forbedre produktet. Vi selger ikke personopplysninger. Full policytekst publiseres her.",
            termsTitle: "Bruksvilkår",
            termsLead: "Reglene for bruk av Shmerling Chess.",
            termsBody:
                "Ved å bruke Shmerling Chess godtar du å spille fair, respektere andre spillere og bruke tjenesten kun til personlig sjakkspill. Fullstendige vilkår publiseres her.",
            contactTitle: "Kontakt",
            contactLead: "Ta kontakt med Shmerling Chess-teamet.",
            contactBody:
                "Kontaktinformasjon for support og personvernspørsmål publiseres her.",
        },
        errorPage: {
            code: "Feil {{code}}",
            notFoundTitle: "Siden ble ikke funnet",
            notFoundMessage: "Siden du leter etter finnes ikke.",
            genericTitle: "Noe gikk galt",
            genericMessage: "Det oppstod en uventet feil. Prøv igjen.",
            backHome: "Tilbake til startsiden",
        },
    },
};

function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function shellChatBlock(t) {
    const c = t.shellChat;
    return [
        `                chat: "${esc(c.chat)}",`,
        `                expandChatPanel: "${esc(c.expandChatPanel)}",`,
        `                collapseChatPanel: "${esc(c.collapseChatPanel)}",`,
        `                chatPlaceholder: "${esc(c.chatPlaceholder)}",`,
        `                chatWatcherReadonly: "${esc(c.chatWatcherReadonly)}",`,
        `                sendChat: "${esc(c.sendChat)}",`,
    ].join("\n");
}

function footerBlock(t) {
    const f = t.footer;
    const lines = Object.keys(f).map(function (k) {
        return `            "${k}": "${esc(f[k])}"`;
    });
    return `        "footer": {\n${lines.join(",\n")}\n        },`;
}

function errorPageBlock(t) {
    const e = t.errorPage;
    const lines = Object.keys(e).map(function (k) {
        return `        "${k}": "${esc(e[k])}"`;
    });
    return `    "errorPage": {\n${lines.join(",\n")}\n    },`;
}

function patchBase(locale, t) {
    const file = path.join(ROOT, locale + ".js");
    let s = fs.readFileSync(file, "utf8");
    let changed = false;

    if (!s.includes("chatWatcherReadonly:")) {
        const re = /(collapseGamesPanel:\s*"[^"]*",\n)(\s*savedListFilter:)/;
        if (!re.test(s)) {
            throw new Error(locale + ".js: collapseGamesPanel/savedListFilter anchor not found");
        }
        s = s.replace(re, "$1" + shellChatBlock(t) + "\n$2");
        changed = true;
    }

    if (!/newGameDialog:[\s\S]*?\bprivate:/.test(s)) {
        const re = /(allowUndo:\s*"[^"]*",\n)(\s*\},)/;
        // more specific: only within newGameDialog — find allowUndo then closing of newGameDialog
        const idx = s.indexOf("newGameDialog:");
        if (idx < 0) {
            throw new Error(locale + ".js: newGameDialog not found");
        }
        const slice = s.slice(idx);
        const m = slice.match(/(allowUndo:\s*"[^"]*",\n)(\s*\},)/);
        if (!m) {
            throw new Error(locale + ".js: allowUndo anchor in newGameDialog not found");
        }
        const insert =
            m[1] +
            `                private: "${esc(t.newGamePrivate.private)}",\n` +
            `                privateHint:\n` +
            `                    "${esc(t.newGamePrivate.privateHint)}",\n` +
            m[2];
        s = s.slice(0, idx) + slice.replace(m[0], insert);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, s, "utf8");
        console.log("updated", path.relative(process.cwd(), file));
    } else {
        console.log("unchanged", path.relative(process.cwd(), file));
    }
}

function patchExtra(locale, t) {
    const file = path.join(ROOT, locale + "-extra.js");
    let s = fs.readFileSync(file, "utf8");
    let changed = false;

    if (!s.includes('"footer"')) {
        // Insert after site.ok before username (en/extra pattern)
        const re = /("ok":\s*"[^"]*",\n)(\s*"username":)/;
        if (!re.test(s)) {
            throw new Error(locale + "-extra.js: site ok/username anchor not found");
        }
        s = s.replace(re, "$1" + footerBlock(t) + "\n$2");
        changed = true;
    }

    if (!s.includes('"privateHint"')) {
        const re = /("private":\s*"[^"]*",\n)(\s*"playComputer":)/;
        if (!re.test(s)) {
            throw new Error(locale + "-extra.js: playNow private/playComputer anchor not found");
        }
        s = s.replace(
            re,
            `$1            "privateHint": "${esc(t.playNowPrivateHint)}",\n$2`,
        );
        changed = true;
    }

    if (!s.includes('"closePreferences"')) {
        const re = /("preferences":\s*"[^"]*",\n)(\s*"display":)/;
        if (!re.test(s)) {
            throw new Error(locale + "-extra.js: chrome preferences/display anchor not found");
        }
        s = s.replace(
            re,
            `$1            "closePreferences": "${esc(t.closePreferences)}",\n$2`,
        );
        changed = true;
    }

    if (!s.includes('"errorPage"')) {
        const re = /(\n)(    "mobile":\s*\{)/;
        if (!re.test(s)) {
            throw new Error(locale + "-extra.js: mobile anchor not found");
        }
        s = s.replace(re, "\n" + errorPageBlock(t) + "\n$2");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, s, "utf8");
        console.log("updated", path.relative(process.cwd(), file));
    } else {
        console.log("unchanged", path.relative(process.cwd(), file));
    }
}

for (const locale of LOCALES) {
    const t = BY_LOCALE[locale];
    if (!t) {
        throw new Error("Missing translations for " + locale);
    }
    patchBase(locale, t);
    patchExtra(locale, t);
}

console.log("done");
