import messages from '../../_locales/en/messages.json' with { type: 'json' };

export type I18nKey = keyof typeof messages;

// Compile time parse for default i18n keys
export function getMessage(key: I18nKey): string {
	return messages[key].message;
}

// Runtime parse for i18n keys
export function getI18nMessage(key: I18nKey): string {
	return chrome.i18n.getMessage(key);
}

export const I18N_HTML_PROPERTIES = ['textContent', 'title'] as const;
type I18nHtmlProperty = typeof I18N_HTML_PROPERTIES[number];

export function getI18nAttribute(property: I18nHtmlProperty) {
	return `data-i18n-${property}`;
}

export function createI18nAttribute(key: I18nKey, property: I18nHtmlProperty = 'textContent') {
	return {
		[getI18nAttribute(property)]: key,
	};
}
