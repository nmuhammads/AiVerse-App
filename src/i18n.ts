import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

import WebApp from '@twa-dev/sdk'

const telegramLanguageDetector = {
    name: 'telegram',
    lookup() {
        return WebApp.initDataUnsafe?.user?.language_code
    },
    cacheUserLanguage() { }
}

const languageDetector = new LanguageDetector()
languageDetector.addDetector(telegramLanguageDetector)

i18n
    .use(Backend)
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'ru',
        debug: import.meta.env.DEV,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
        },

        detection: {
            order: ['localStorage', 'telegram', 'navigator'],
            caches: ['localStorage'],
        },
        react: {
            useSuspense: false
        }
    })

export default i18n
