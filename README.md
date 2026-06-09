# OTP Input — Mendix Native Pluggable Widget

A production-ready OTP (One-Time Password) input widget for **Mendix Native Mobile** apps. Provides individual digit boxes with full support for **SMS auto-fill** (Android via SMS Retriever API), **iOS `oneTimeCode` auto-fill**, secure entry, resend-trigger, and deep external styling.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Setting the Project Path](#setting-the-project-path)
- [Widget Properties](#widget-properties)
  - [Data](#data)
  - [Behaviour](#behaviour)
  - [Appearance](#appearance)
- [External Styling](#external-styling)
  - [Style Keys Reference](#style-keys-reference)
  - [Creating an External Style File](#creating-an-external-style-file)
  - [Example: Dark Theme](#example-dark-theme)
  - [Example: Rounded Pill Boxes](#example-rounded-pill-boxes)
  - [How Styles Merge](#how-styles-merge)
- [SMS Auto-Fill Setup (Android)](#sms-auto-fill-setup-android)
  - [SMS Format Requirements](#sms-format-requirements)
  - [Getting the App Hash](#getting-the-app-hash)
  - [SMS Timeout](#sms-timeout)
  - [Resend OTP Flow](#resend-otp-flow)
- [iOS Auto-Fill](#ios-auto-fill)
- [Project Structure](#project-structure)
- [Development & Contribution](#development--contribution)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- **Individual digit boxes** — configurable OTP length (4–8 digits)
- **SMS auto-fill (Android)** — uses `react-native-otp-verify` and the SMS Retriever API; zero extra permissions
- **iOS auto-fill** — leverages `textContentType="oneTimeCode"` for native keyboard suggestions
- **Secure text entry** — mask digits with `•` for sensitive flows
- **Placeholder character** — show a custom character (e.g. `–` or `·`) in empty boxes
- **Auto-fill badge** — optional badge displayed when the OTP is filled automatically
- **Hint text** — customisable instructional text below the input
- **Resend trigger** — clear the OTP and restart the SMS listener via a Boolean attribute toggle
- **On Complete / On Change actions** — trigger nanoflows or microflows at the right moment
- **Fully styleable** — override every visual element via Mendix's native styling system
- **Resilient** — graceful fallbacks when `react-native-otp-verify` is unavailable, guarded async callbacks, and malformed-style protection

---

## Installation

1. Download or build the widget `.mpk` file (see [Development & Contribution](#development--contribution)).
2. Copy the `.mpk` into your Mendix project's `widgets/` folder.
3. Run **App > Synchronize App Directory** (F4) in Studio Pro.
4. The **OTP Input** widget will appear under the **Add-on widgets** category in the toolbox.

---

## Setting the Project Path

During development, the widget build tooling needs to know where your **Mendix project** lives so it can automatically deploy the compiled bundle into the correct `deployment/` and `widgets/` folders.

This is configured via the `config.projectPath` field in [`package.json`](./package.json):

```jsonc
{
  "config": {
    "projectPath": "C:\\\\Mendix_Projects\\\\Your-Mendix-App"
  }
}
```

### How to set it

1. Open [`package.json`](./package.json) in the project root.
2. Locate the `"config"` → `"projectPath"` entry.
3. Replace the value with the **absolute path** to your local Mendix project directory.
   - This is the folder that contains the `.mpr` file.
   - Use **double-escaped backslashes** (`\\\\`) on Windows.

### Examples

| OS | Value |
| --- | --- |
| Windows | `"C:\\\\Mendix_Projects\\\\MyApp"` |
| macOS / Linux | `"/Users/you/Documents/Mendix/MyApp"` |

> **Tip:** After changing the path, run `npm start`. The tooling will bundle the widget and copy it into `<projectPath>/deployment/` and `<projectPath>/widgets/` automatically on every save.

---

## Widget Properties

Configure the widget from the Mendix Studio Pro **Properties** panel. All properties are defined in [`OtpInput.xml`](./src/OtpInput.xml).

### Data

| Property | Type | Required | Default | Description |
| --- | --- | :---: | --- | --- |
| **OTP value** (`otpValue`) | String attribute | ✅ | — | The attribute that stores the current OTP string. Must be writable. |

### Behaviour

| Property | Type | Required | Default | Description |
| --- | --- | :---: | --- | --- |
| **OTP length** (`otpLength`) | Integer | ✅ | `6` | Number of digit boxes to render (typically 4 or 6). |
| **Secure text entry** (`secureTextEntry`) | Boolean | — | `false` | When `true`, entered digits are masked as `•`. |
| **Auto focus** (`autoFocus`) | Boolean | — | `false` | Automatically focus the input when the widget mounts. |
| **Placeholder character** (`placeholderChar`) | String | — | _(empty)_ | A single character displayed in empty boxes (e.g. `–`). |
| **On complete** (`onComplete`) | Action | — | — | Action (nanoflow/microflow) executed when all digits are entered. |
| **On change** (`onChange`) | Action | — | — | Action executed every time a digit changes. |
| **Console App Hash** (`consoleAppHash`) | Boolean expression | — | — | When `true`, logs the Android App Hash to the console and displays it below the widget. Useful during SMS template setup. |
| **SMS Autofill Timeout** (`smsTimeout`) | Integer | ✅ | `300` | Seconds to listen for the incoming SMS before the listener times out. Maximum effective value is 300 s (Android OS limit). |
| **Resend trigger** (`resendTrigger`) | Boolean attribute | — | — | Set to `true` from a nanoflow to clear the current OTP and restart the SMS listener. The widget automatically resets it to `false`. |

### Appearance

| Property | Type | Required | Default | Description |
| --- | --- | :---: | --- | --- |
| **Show auto-fill badge** (`showBadge`) | Boolean | — | `true` | Display a pill badge when the OTP is auto-filled. |
| **Badge text** (`badgeText`) | String | — | `"Auto-filled"` | Custom label for the auto-fill badge. |
| **Show hint** (`showHint`) | Boolean | — | `true` | Show the instructional text below the boxes. |
| **Custom hint** (`customHint`) | String | — | _(auto)_ | Override the default hint text. If empty, shows `"OTP filled automatically."` after auto-fill, or `"Enter the OTP sent to your registered contact"` otherwise. |

---

## External Styling

The widget fully supports Mendix's **native styling** system. You can override every visual element without modifying the widget source code.

### Style Keys Reference

The widget exposes the following style keys. Each key maps to a specific part of the UI:

```
┌─────────────────────────────────────────┐
│              container                  │    ← Outermost wrapper
│                                         │
│          ┌─────────────┐                │
│          │    badge    │                │    ← Auto-fill pill badge
│          │  badgeText  │                │
│          └─────────────┘                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │              row                  │  │    ← Horizontal row of boxes
│  │  ┌─────┐ ┌─────┐ ┌─────┐          │  │
│  │  │ box │ │ box │ │ box │          │  │    ← Individual digit box
│  │  │Text │ │Text │ │Text │          │  │    ← boxText inside each box
│  │  └─────┘ └─────┘ └─────┘          │  │
│  └───────────────────────────────────┘  │
│                                         │
│                hint                     │    ← Hint text
│                                         │
│                hint                     │    ← appHash text
└─────────────────────────────────────────┘
```

| Style Key | Type | Description |
| --- | --- | --- |
| `container` | `ViewStyle` | Outermost wrapper around the entire widget. |
| `badge` | `ViewStyle` | The auto-fill badge pill container. |
| `badgeText` | `TextStyle` | Text inside the badge. |
| `row` | `ViewStyle` | The horizontal row that holds all digit boxes. |
| `box` | `ViewStyle` | Default style for each digit box. |
| `boxFilled` | `ViewStyle` | Applied on top of `box` when a digit has been entered. |
| `boxAuto` | `ViewStyle` | Applied on top of `box` when the OTP was auto-filled. |
| `boxFocused` | `ViewStyle` | Applied on top of `box` when the box is currently focused. |
| `boxText` | `TextStyle` | The digit text inside each box. |
| `boxTextFocused` | `TextStyle` | Applied on top of `boxText` when focused. |
| `hint` | `TextStyle` | The instructional text below the boxes. |

### Creating an External Style File

1. In your Mendix project, navigate to the **native styling** directory:
   ```
   <MendixProject>/theme/native/
   ```

2. Create or open a custom style file (e.g. `custom-variables.js` or a dedicated file).

3. Export a style object targeting the widget's full ID: `strebentechnik.otpinput.OtpInput`.

**File: `<MendixProject>/theme/native/custom-variables.js`**

```javascript
// ── OTP Input Styling ────────────────────────────────
export const strebentechnik_otpinput_OtpInput = {
    // Override the outer container
    container: {
        alignItems: "center",
        paddingVertical: 8,
        backgroundColor: "#FAFAFA"
    },

    // Style the digit boxes
    box: {
        borderWidth: 2,
        borderColor: "#D1D5DB",
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        minWidth: 44,
        maxWidth: 56,
        minHeight: 48,
        maxHeight: 64
    },

    // Focused box gets a brand-colored border
    boxFocused: {
        borderColor: "#6366F1",
        backgroundColor: "#EEF2FF"
    },

    // Filled box
    boxFilled: {
        borderColor: "#9CA3AF",
        backgroundColor: "#F9FAFB"
    },

    // Digit text styling
    boxText: {
        fontSize: 24,
        fontWeight: "700",
        color: "#111827"
    },

    boxTextFocused: {
        color: "#6366F1"
    },

    // Hint text
    hint: {
        fontSize: 13,
        color: "#6B7280",
        marginTop: 16
    },

    // Auto-fill badge
    badge: {
        backgroundColor: "#ECFDF5",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 14
    },

    badgeText: {
        color: "#065F46",
        fontSize: 12,
        fontWeight: "600"
    }
};
```

> **Important:** Mendix converts the widget's XML `id` (`strebentechnik.otpinput.OtpInput`) to an export name by replacing dots with underscores → `strebentechnik_otpinput_OtpInput`.

### Example: Dark Theme

```javascript
export const strebentechnik_otpinput_OtpInput = {
    container: {
        backgroundColor: "#0F172A",
        paddingVertical: 12
    },
    box: {
        borderColor: "#334155",
        backgroundColor: "#1E293B",
        borderRadius: 10,
        borderWidth: 1.5
    },
    boxFocused: {
        borderColor: "#818CF8",
        backgroundColor: "#1E1B4B"
    },
    boxFilled: {
        borderColor: "#475569",
        backgroundColor: "#1E293B"
    },
    boxText: {
        color: "#F1F5F9",
        fontSize: 22,
        fontWeight: "600"
    },
    boxTextFocused: {
        color: "#A5B4FC"
    },
    hint: {
        color: "#94A3B8",
        fontSize: 13
    },
    badge: {
        backgroundColor: "#1E3A5F",
        borderRadius: 12
    },
    badgeText: {
        color: "#93C5FD",
        fontWeight: "600"
    },
    row: {
        gap: 12
    }
};
```

### Example: Rounded Pill Boxes

```javascript
export const strebentechnik_otpinput_OtpInput = {
    box: {
        borderRadius: 999,    // fully rounded
        borderWidth: 2,
        borderColor: "#E5E7EB",
        aspectRatio: 1,       // perfect circle
        minWidth: 48,
        maxWidth: 48,
        minHeight: 48,
        maxHeight: 48
    },
    boxFocused: {
        borderColor: "#8B5CF6",
        backgroundColor: "#F5F3FF"
    },
    boxText: {
        fontSize: 20,
        fontWeight: "700"
    }
};
```

### How Styles Merge

The widget merges external styles on top of its built-in defaults using a **shallow-merge-per-key** strategy:

1. The widget starts with its [built-in default styles](./src/OtpInput.tsx#L40-L71).
2. Mendix passes your external styles via the `style` prop as an array.
3. For each style key (`box`, `hint`, etc.), the widget does:
   ```
   finalStyle[key] = { ...defaultStyle[key], ...yourStyle[key] }
   ```
4. You only need to specify the properties you want to override — everything else falls back to the defaults.
5. If the external style is malformed or missing, the widget falls back to the full default style gracefully.

---

## SMS Auto-Fill Setup (Android)

The widget uses [`react-native-otp-verify`](https://github.com/faizalshap/react-native-otp-verify) which wraps the **Android SMS Retriever API**. This approach requires **no SMS permissions** from the user.

### SMS Format Requirements

The SMS sent by your backend **must** follow this format:

```
<#> Your OTP code is 123456
FA+9qCX9VSu
```

Rules:
1. The message must start with `<#>`.
2. The message must contain the OTP digits (4–8 digits). The widget searches for them using keyword-anchored regex (`otp`, `code`, `pin`, `verify`, `passcode`), falling back to any 4–8 digit sequence.
3. The message must end with the **11-character App Hash** on its own line.
4. The total message length must not exceed **140 bytes**.

### Getting the App Hash

The App Hash is unique to your app's signing certificate and package name. To retrieve it:

1. Add the widget to a page.
2. Set the **Console App Hash** property to `true`.
3. Run the app on an Android device/emulator.
4. Check the **Metro/React Native console** for the log:
   ```
   OTP Input Android App Hash: FA+9qCX9VSu
   ```
5. The hash is also displayed below the widget when `Console App Hash` is `true`.
6. Give this hash to your backend team to append to OTP SMS messages.

### SMS Timeout

The **SMS Autofill Timeout** property controls how long the widget's JavaScript listener stays active (default: 300 seconds). Note that the Android SMS Retriever session at the OS level always times out at 5 minutes, regardless of this setting — setting a shorter value only stops JS-side processing early.

### Resend OTP Flow

To implement a "Resend OTP" button:

1. Add a **Boolean attribute** to your entity (e.g. `ResendOTP`), defaulting to `false`.
2. Assign it to the widget's **Resend trigger** property.
3. In your "Resend" button's nanoflow:
   - Call your backend to re-send the SMS.
   - **Set `ResendOTP` to `true`**.
4. The widget will:
   - Clear the current OTP.
   - Stop the old SMS listener.
   - Start a **new** SMS listener.
   - Reset the trigger back to `false` automatically.

---

## iOS Auto-Fill

On **iOS**, the widget sets `textContentType="oneTimeCode"` and `autoComplete="one-time-code"` on its hidden `TextInput`. This enables iOS's native OTP auto-fill:

- When an SMS or iMessage containing an OTP arrives, iOS shows the code in the **keyboard suggestion bar**.
- The user taps the suggestion and the widget fills automatically.
- **No native module** is required for iOS — it works out of the box.

Additionally, if your backend sends the OTP via a **deep link** and your Mendix nanoflow sets the `otpValue` attribute, the widget will detect the change, fill the boxes, and fire `onComplete`.

---

## Project Structure

```
otpInput/
├── src/
│   ├── OtpInput.tsx            # Main widget component
│   ├── OtpInput.xml            # Widget property definitions
│   ├── OtpInput.editorConfig.ts # Studio Pro editor config
│   ├── package.xml             # Widget packaging manifest
│   └── components/             # (reserved for sub-components)
├── typings/
│   └── OtpInputProps.d.ts      # Auto-generated TypeScript props
├── dist/                       # Build output (.mpk)
├── package.json                # NPM config & project path
├── tsconfig.json               # TypeScript configuration
├── LICENSE                     # Apache 2.0
└── README.md                   # This file
```

---

## Development & Contribution

### Prerequisites

- **Node.js** ≥ 20
- **NPM** (comes with Node.js)
- A **Mendix project** to test against

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/NevinMichael10/mx-otp-input.git
   cd mx-otp-input
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   > If you're on NPM v7+ and encounter peer dependency errors, use:
   > ```bash
   > npm install --legacy-peer-deps
   > ```

3. Set the [project path](#setting-the-project-path) in [`package.json`](./package.json).

4. Start the development watcher:
   ```bash
   npm start
   ```
   On every file change:
   - The widget is bundled.
   - The `.mpk` is placed in `dist/`.
   - The bundle is copied into the Mendix project's `deployment/` and `widgets/` folders.

### Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start development mode with hot-reload into Mendix project |
| `npm run build` | One-time production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run release` | Build a release-ready `.mpk` |

### Key Files

| File | Purpose |
| --- | --- |
| [`package.json`](./package.json) | Project metadata, scripts, and **project path** config |
| [`src/OtpInput.tsx`](./src/OtpInput.tsx) | Core widget logic — rendering, SMS listening, state management |
| [`src/OtpInput.xml`](./src/OtpInput.xml) | Property definitions visible in Studio Pro |
| [`typings/OtpInputProps.d.ts`](./typings/OtpInputProps.d.ts) | Auto-generated TypeScript types (do not edit manually) |

---

## Troubleshooting

### SMS auto-fill not working (Android)

| Issue | Solution |
| --- | --- |
| `react-native-otp-verify is not available` in console | Ensure `react-native-otp-verify` is installed and linked. Rebuild the native app. |
| SMS received but OTP not extracted | Ensure your SMS contains a keyword (`otp`, `code`, `pin`, `verify`, `passcode`) before the digits, and ends with the correct App Hash. |
| Listener times out before SMS arrives | Increase the **SMS Autofill Timeout** property (max effective: 300 s). |
| Auto-fill works once but not on resend | Use the **Resend trigger** property — it restarts the listener properly. |

### iOS auto-fill not showing

| Issue | Solution |
| --- | --- |
| No suggestion in keyboard bar | Ensure the SMS/iMessage arrives while the widget is focused. iOS auto-fill only works with the keyboard visible. |
| Using a custom keyboard | Third-party keyboards may not support `oneTimeCode` suggestions. |

### Style not applying

| Issue | Solution |
| --- | --- |
| Exported style has no effect | Verify the export name matches: `strebentechnik_otpinput_OtpInput` (dots → underscores). |
| Partial styles missing | You only need to export the keys you want to override — others fall back to defaults. Make sure each key's value is a valid React Native style object. |

---

## License

[Apache License 2.0](./LICENSE) — © Mendix Technology BV 2026. All rights reserved.
