import 'jsx-async-runtime';

declare module 'react/jsx-runtime' {
	// Declare an empty namespace so VSCode uses 'jsx-async-runtime' types
	namespace JSX {
	}
}
