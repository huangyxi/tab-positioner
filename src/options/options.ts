// The filename should be different from .tsx for the linter to work correctly
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

function getElementSetting(
	element: SettingElement,
): ExtensionSettings[SettingKey] | null | undefined {
	const settingKey = element.id as SettingKey;
	if (!(settingKey in DEFAULT_SETTINGS)) return;
	switch (element.type) {
		case 'checkbox':
			return element.checked as any;
		case 'number':
			if (!element.validity.valid) {
				return null; // Invalid number input
			}
			return element.valueAsNumber as any;
		case 'select-one':
			return element.value as any;
		default:
			return undefined;
	}
}

function showStatus(
	messageKey: I18nKey,
	delay: number = 1500,
	args?: string[],
) {
	const status = document.getElementById('status');
	if (!status) return;
	status.textContent = getI18nMessage(messageKey, args);
	status.style.opacity = '1';
	setTimeout(() => {
		status.style.opacity = '0';
	}, delay);
}

function localizeHtmlPage() {
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

function showInputInvalid(element: HTMLInputElement) {
	const delay = 3000;
	const min = element.min;
	const max = element.max;
	if (min !== '' && max !== '') {
		showStatus('status_input_invalid_min_max', delay, [min, max]);
		return;
	}
	if (min !== '') {
		showStatus('status_input_invalid_min', delay, [min]);
		return;
	}
	if (max !== '') {
		showStatus('status_input_invalid_max', delay, [max]);
		return;
	}
	showStatus('status_input_invalid');
}

async function saveSetting(elements:
	| SettingElement
	| Array<SettingElement>
	| NodeListOf<SettingElement>
) {
	if (elements instanceof HTMLElement) {
		elements = [elements];
	}
	const settings: Partial<Record<SettingKey, any>> = {}
	for (const element of elements) {
		const settingKey = element.id as SettingKey;
		if (!(settingKey in DEFAULT_SETTINGS)) continue;
		const setting = getElementSetting(element);
		if (setting === undefined) continue; // Skip if no setting found
		if (setting === null && element.type === 'number') {
			showInputInvalid(element as HTMLInputElement);
			return; // Invalid number input
		}
		settings[settingKey] = setting;
	}
	await saveSettings(settings, true);
	showStatus('status_settings_saved');
}

async function restoreSettings(elements: NodeListOf<SettingElement>) {
	const settings = await loadSettings();
	for (const element of elements) {
		setElementSetting(element, settings);
	}
}

async function resetSetting(form: HTMLFormElement) {
	const settingKey = form.id as SettingKey;
	if (!(settingKey in DEFAULT_SETTINGS)) return;
	await saveSettings({ [settingKey]: DEFAULT_SETTINGS[settingKey] }, true);
	showStatus('status_settings_saved');
}

async function resetAllSettings(elements: NodeListOf<SettingElement>) {
	for (const element of elements) {
		setElementSetting(element, DEFAULT_SETTINGS);
	}
	await clearSettings();
	await saveSettings();
	showStatus('status_settings_saved');
}

function isOptionsPage() {
	const m = api.runtime.getManifest();
	const optionsURI = api.runtime.getURL(m.options_page || m.options_ui?.page || 'options.html');
	const isOptionsPage = window.location.href === optionsURI
	return isOptionsPage;
}

function openDetails() {
	const details = document.querySelector('details');
	if (!details) return;
	details.open = true;
}


async function main() {
	localizeHtmlPage();

	const elements = document.querySelectorAll('select, input[type="checkbox"], input[type="number"]') as NodeListOf<SettingElement>;
	const forms = document.querySelectorAll('form') as NodeListOf<HTMLFormElement>;

	await restoreSettings(elements);

	elements.forEach(element => {
		element.addEventListener('change', () => saveSetting(element));
	});

	forms.forEach(form => {
		form.addEventListener('reset', async (event) => {
			await resetSetting(form);
		});
	});

	document.getElementById('reset-all')?.addEventListener('click', () => resetAllSettings(elements));

	if (isOptionsPage()) {
		openDetails();
	}
}

main();
