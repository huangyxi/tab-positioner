
import { I18nKey, getI18nMessage, getI18nAttribute, I18N_HTML_PROPERTIES } from '../shared/i18n';
import { SettingKey, ExtensionSettings, DEFAULT_SETTINGS } from '../shared/settings';
import { loadSettings, saveSettings, clearSettings } from '../shared/storage';

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

async function saveSetting(selectElements: NodeListOf<HTMLSelectElement>) {
	const settings: Partial<Record<SettingKey, string>> = {}
	for (const select of selectElements) {
		const settingKey = select.id as SettingKey;
		if (!(settingKey in DEFAULT_SETTINGS)) continue;
		settings[settingKey] = select.value;
	}
	await saveSettings(settings as ExtensionSettings, true);
	showStatus('statusSaved');
}

async function restoreSettings(selectElements: NodeListOf<HTMLSelectElement>) {
	const settings = await loadSettings();
	for (const select of selectElements) {
		const settingKey = select.id as SettingKey;
		if (!(settingKey in settings)) continue;
		select.value = settings[settingKey];
	}
}

async function resetSetting(settingKey: SettingKey, selectElements: NodeListOf<HTMLSelectElement>) {
	for (const selectElement of selectElements) {
		if (selectElement.id !== settingKey) continue;
		selectElement.value = DEFAULT_SETTINGS[settingKey];
		await saveSettings({ [settingKey]: DEFAULT_SETTINGS[settingKey] });
		showStatus('statusSaved');
		return;
	}
}

async function resetAllSettings(selectElements: NodeListOf<HTMLSelectElement>) {
	for (const selectElement of selectElements) {
		const settingKey = selectElement.id as SettingKey;
		if (!(settingKey in DEFAULT_SETTINGS)) continue;
		selectElement.value = DEFAULT_SETTINGS[settingKey];
	}
	await clearSettings();
	await saveSettings();
	showStatus('statusSaved');
}

async function main() {
	localizeHtmlPage();

	const selectElements = document.querySelectorAll('select');

	await restoreSettings(selectElements);

	document.querySelectorAll('select').forEach(select => {
		select.addEventListener('change', () => saveSetting(selectElements));
	});

	document.querySelectorAll('button.reset').forEach(button => {
		const settingKey = button.id.replace('reset-', '') as SettingKey;
		button.addEventListener('click', () => resetSetting(settingKey, selectElements));
	});

	document.getElementById('reset-all')?.addEventListener('click', () => resetAllSettings(selectElements));
}

main();
