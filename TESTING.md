# Manual Testing Instructions

This document outlines the key steps for manually testing the application before release.

## Checklist

### User Interface

* [ ] Verify that all UI elements are responsive and accessible in both the popup and the options page.
* [ ] Ensure that UI elements are properly styled and functional across all supported operating systems and in both light and dark modes.
* [ ] Ensure that the `padding-bottom` of the `body` element is set correctly in the options page CSS to accommodate the `footer`.

### Functionality

* [ ] Test all combinations of the extension's settings to ensure they function as expected.
* [ ] Confirm that the extension functions correctly with and without the `$debug_mode` setting.
* [ ] Check that tab creation and activation work correctly after the extension has been offloaded (`FIRST_ACTIVATION_DELAY_MS`).
* [ ] Verify that tab groups and their order are preserved when tabs are restored (`MAX_BATCH_DELAY_MS`).
* [ ] Ensure that the new tab page is detected correctly in all supported browsers (`NEW_PAGE_URIS`).
