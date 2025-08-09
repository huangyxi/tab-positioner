// The filename should be different from .tsx for the linter to work correctly
import { I18nKey, getI18nMessage, getI18nAttribute, I18N_HTML_PROPERTIES } from '../shared/i18n';
import type { SettingKey, ExtensionSettings } from '../shared/settings';
import { DEFAULT_SETTINGS, SETTING_SCHEMAS } from '../shared/settings';
import { loadSettings, saveSettings, clearSettings } from '../shared/storage';

type SettingElement = HTMLSelectElement | HTMLInputElement;

function getFormSetting(form: HTMLFormElement): ExtensionSettings[SettingKey] | null | undefined {
	const settingKey = form.id;
	if (!(settingKey in DEFAULT_SETTINGS)) return undefined;
	const element = form[settingKey] as SettingElement;
	if (!element) return undefined;
	switch (element.type) {
		case 'checkbox':
			return element.checked;
		case 'number':
			if (!element.validity.valid) {
				return null; // Invalid number input
			}
			return element.valueAsNumber;
		case 'select-one':
			return element.value as any;
		default:
			console.warn(`Unsupported element type: ${element.type} for setting ${settingKey}`);
			return undefined; // Unsupported type
	}
}

function setFormSetting(
	form: HTMLFormElement,
	settings: ExtensionSettings = DEFAULT_SETTINGS,
) {
	const settingKey = form.id as SettingKey;
	if (!(settingKey in settings)) return;
	const element = form[settingKey] as SettingElement;
	if (!element) return;
	switch (element.type) {
		case 'checkbox':
			element.checked = settings[settingKey] as boolean;
			break;
		case 'number':
			element.valueAsNumber = settings[settingKey] as number;
			break;
		case 'select-one':
			element.value = settings[settingKey] as string;
			break;
		default:
			console.warn(`Unsupported element type: ${element.type} for setting ${settingKey}`);
			return;
	}
}

function toggleResetButton(
	form: HTMLFormElement,
	unchanged: boolean | undefined = undefined,
) {
	const settingKey = form.id as SettingKey;
	if (!(settingKey in DEFAULT_SETTINGS)) return;
	const setting = getFormSetting(form);
	if (setting === undefined) return;
	if (unchanged === true) {
		form.dataset.unchanged = 'true';
		return;
	}
	if (unchanged === false) {
		delete form.dataset.unchanged;
		return;
	}
	if (setting === DEFAULT_SETTINGS[settingKey]) {
		form.dataset.unchanged = 'true';
		return;
	}
	delete form.dataset.unchanged;
}

function showStatus(
	messageKey: I18nKey,
	// Corresponds to the status types used in the CSS
	type: 'success' | 'error' = 'success',
	delay: number = 1500,
	args?: string[],
) {
	const status = document.getElementById('status');
	if (!status) return;
	status.textContent = getI18nMessage(messageKey, args);
	status.dataset.type = type;
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

async function restoreFormSettings(forms: NodeListOf<HTMLFormElement>) {
	const settings = await loadSettings();
	for (const form of forms) {
		setFormSetting(form, settings);
		toggleResetButton(form);
	}
}

async function saveFormSettings(forms:
	| HTMLFormElement
	| Array<HTMLFormElement>
	| NodeListOf<HTMLFormElement>,
	defaultSettings: ExtensionSettings = DEFAULT_SETTINGS,
) {
	if (forms instanceof HTMLElement) {
		forms = [forms];
	}
	const settings: Partial<Record<SettingKey, any>> = {}
	for (const form of forms) {
		toggleResetButton(form);
		const settingKey = form.id as SettingKey;
		if (!(settingKey in defaultSettings)) {
			return;
		}
		const setting = getFormSetting(form);
		if (setting === undefined) continue;
		if (setting === null) {
			showStatus('status_input_invalid', 'error', 3000);
			return;
		}
		settings[settingKey] = setting;
	}
	await saveSettings(settings, true);
	showStatus('status_settings_saved');
}

async function resetFormSetting(form: HTMLFormElement) {
	const settingKey = form.id as SettingKey;
	if (!(settingKey in DEFAULT_SETTINGS)) return;
	toggleResetButton(form, true);
	const defaultsetting = DEFAULT_SETTINGS[settingKey];
	await saveSettings({ [settingKey]: defaultsetting }, true);
	showStatus('status_settings_saved');
}

async function resetFormSettings(forms: NodeListOf<HTMLFormElement>) {
	for (const form of forms) {
		setFormSetting(form, DEFAULT_SETTINGS);
		toggleResetButton(form);
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

	const forms = document.querySelectorAll('form') as NodeListOf<HTMLFormElement>;

	await restoreFormSettings(forms);

	forms.forEach(form => {
		form.addEventListener('change', async () => await saveFormSettings(form));
	});

	forms.forEach(form => {
		form.addEventListener('reset', async (event) => {
			await resetFormSetting(form);
		});
	});

	document.getElementById('reset-all')?.addEventListener('click', async () => {
		await resetFormSettings(forms)
	});

	if (isOptionsPage()) {
		openDetails();
	}
}

main();
