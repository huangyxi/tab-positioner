
import { I18nKey, getI18nMessage, getI18nAttribute, I18N_HTML_PROPERTIES } from '../shared/i18n';
import type { SettingKey, ExtensionSettings } from '../shared/settings';
import { DEFAULT_SETTINGS, SETTING_SCHEMAS } from '../shared/settings';
import { loadSettings, saveSettings, clearSettings } from '../shared/storage';

type SettingElement = HTMLSelectElement | HTMLInputElement;

function setElementSetting(
	element: SettingElement,
	settings: ExtensionSettings = DEFAULT_SETTINGS,
) {
	const settingKey = element.id as SettingKey;
	if (!(settingKey in settings)) return;
	switch (element.type) {
		case 'checkbox':
			element.checked = settings[settingKey] as boolean;
			break;
		case 'number':
			element.valueAsNumber = settings[settingKey] as any;
			break;
		case 'select-one':
			element.value = settings[settingKey] as string;
			break;
	}
}

function showStatus(messageKey: I18nKey) {
	const status = document.getElementById('status');
	if (!status) return;
	status.textContent = getI18nMessage(messageKey);
	status.style.opacity = '1';
	setTimeout(() => {
		status.style.opacity = '0';
	}, 1500);
}

function localizeHtmlPage() {
	document.title = getI18nMessage('settingsTitle');

	// Localize elements with data-i18n attributes
	I18N_HTML_PROPERTIES.forEach(property => {
		const attribute = getI18nAttribute(property);
		document.querySelectorAll(`[${attribute}]`).forEach(elem => {
			if (!(elem instanceof HTMLElement)) return;
			const messageKey = elem.getAttribute(attribute);
			if (!messageKey) return;
			elem[property] = getI18nMessage(messageKey as I18nKey);
		})
	});
}

async function saveSetting(elements: NodeListOf<SettingElement>) {
	const settings: Partial<Record<SettingKey, any>> = {}
	for (const element of elements) {
		const settingKey = element.id as SettingKey;
		if (!(settingKey in DEFAULT_SETTINGS)) continue;
		switch (element.type) {
			case 'checkbox':
				settings[settingKey] = element.checked;
				break;
			case 'number':
				settings[settingKey] = element.valueAsNumber;
				break;
			case 'select-one':
				settings[settingKey] = element.value;
				break;
		}
	}
	await saveSettings(settings, true);
	showStatus('statusSaved');
}

async function restoreSettings(elements: NodeListOf<SettingElement>) {
	const settings = await loadSettings();
	for (const element of elements) {
		setElementSetting(element, settings);
	}
}

async function resetSetting(settingKey: SettingKey, elements: NodeListOf<SettingElement>) {
	for (const element of elements) {
		if (element.id !== settingKey) continue;
		setElementSetting(element, DEFAULT_SETTINGS);
		await saveSettings({ [settingKey]: DEFAULT_SETTINGS[settingKey] });
		showStatus('statusSaved');
		return;
	}
}

async function resetAllSettings(elements: NodeListOf<SettingElement>) {
	for (const element of elements) {
		setElementSetting(element, DEFAULT_SETTINGS);
	}
	await clearSettings();
	await saveSettings();
	showStatus('statusSaved');
}

async function main() {
	localizeHtmlPage();

	const selectElements = document.querySelectorAll('select');
	const elements = document.querySelectorAll('select, input[type="checkbox"], input[type="number"]') as NodeListOf<SettingElement>;

	await restoreSettings(elements);

	elements.forEach(element => {
		element.addEventListener('change', () => saveSetting(elements));
	});

	document.querySelectorAll('button.reset').forEach(button => {
		const settingKey = button.id.replace('reset-', '') as SettingKey;
		button.addEventListener('click', () => resetSetting(settingKey, elements));
	});

	document.getElementById('reset-all')?.addEventListener('click', () => resetAllSettings(elements));
}

main();
