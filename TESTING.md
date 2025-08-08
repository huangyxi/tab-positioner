# Manual Testing Instructions

This document outlines the key steps for manually testing the application before release.

## Checklist

### User Interface

* [ ] Verify that all UI elements are responsive and accessible in both the **popup** and the **options page** across all supported languages. Pay special attention to:
	* [ ] The `min-width` of the popup in languages with longer text to ensure the popup is not too narrow.
	* [ ] Fonts available in the browser are used correctly, especially for languages that require specific fonts.
* [ ] Ensure that UI elements are properly styled and functional across all supported operating systems and in both light and dark modes.
* [ ] Ensure that the default values for inputs other than existing `input[type="checkbox"]`, `input[type="number"]`, and `select` elements are correctly set in the options page, so that settings can be properly restored in the `form`.
* [ ] Ensure that the `padding-bottom` of the `body` element is set correctly in the options page CSS to accommodate the `footer`.

### Functionality

* [ ] Test all combinations of the extension's settings to ensure they function as expected.
* [ ] Confirm that the extension works correctly with `_debug_mode` both enabled and disabled.
* [ ] Check that tab creation and activation work correctly after the extension has been offloaded (`FIRST_ACTIVATION_DELAY_MS`).
* [ ] Verify that tab groups and their order are preserved when tabs are restored (`MAX_BATCH_DELAY_MS`).
* [ ] Ensure that the new tab page is detected correctly in all supported browsers (`NEW_PAGE_URIS`).
