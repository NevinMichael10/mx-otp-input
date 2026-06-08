import { Component, ReactNode } from "react";
import { View, TextInput, Text, Pressable, Platform, Keyboard, ViewStyle, TextStyle } from "react-native";
import { ValueStatus } from "mendix";

import { OtpInputProps } from "../typings/OtpInputProps";

declare let require: any;

let OtpVerifyModule: any = null;
try {
    OtpVerifyModule = Platform.OS === "android" ? require("react-native-otp-verify") : null;
} catch (error) {
    console.debug("OTP Input: react-native-otp-verify is not available", error);
}
const OtpVerify = OtpVerifyModule ? OtpVerifyModule.default || OtpVerifyModule : null;
const getHash = OtpVerifyModule ? OtpVerifyModule.getHash : null;

// ── OTP regex: keyword-anchored, matches 4–8 digit codes ─────
// Looks for OTP/code/pin/verify keywords before the digits to avoid
// matching order numbers, phone numbers, or other numeric strings.
const OTP_REGEX = /(?:otp|code|pin|verify|verification|passcode)[^\d]{0,10}(\d{4,8})/i;

const OTP_FALLBACK_REGEX = /\b(\d{4,8})\b/;

// ── Style types ──────────────────────────────────────────────
export interface CustomStyle {
    container?: ViewStyle;
    badge?: ViewStyle;
    badgeText?: TextStyle;
    row?: ViewStyle;
    box?: ViewStyle;
    boxFilled?: ViewStyle;
    boxAuto?: ViewStyle;
    boxFocused?: ViewStyle;
    boxText?: TextStyle;
    boxTextFocused?: TextStyle;
    hint?: TextStyle;
}

const defaultStyle: Required<CustomStyle> = {
    container: { alignItems: "center", paddingVertical: 4 },
    badge: {
        backgroundColor: "#E6F4EE",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 12
    },
    badgeText: { color: "#0F6E56", fontSize: 13, fontWeight: "500" },
    row: { flexDirection: "row", gap: 10, justifyContent: "center", width: "100%" },
    box: {
        flex: 1,
        minWidth: 32,
        maxWidth: 56,
        minHeight: 38,
        maxHeight: 66,
        aspectRatio: 46 / 54,
        borderWidth: 1.5,
        borderColor: "#E6E6E6",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FFFFFF"
    },
    boxFilled: { borderColor: "#B3B3B3", backgroundColor: "#fcfcfc" },
    boxAuto: { borderColor: "#B3B3B3", backgroundColor: "#fcfcfc" },
    boxFocused: { borderColor: "#41348D", backgroundColor: "#F2F8FF" },
    boxText: { fontSize: 22, fontWeight: "600", color: "#1A1A18", textAlign: "center" },
    boxTextFocused: { color: "#41348D" },
    hint: { marginTop: 14, fontSize: 13, color: "#6B6965", textAlign: "center" }
};

// FIX: Wrapped in try/catch — resilient against malformed style shapes from Mendix
function mergeStyles(styles: any): CustomStyle {
    try {
        if (!styles || !Array.isArray(styles) || styles.length === 0) {
            return defaultStyle;
        }
        const merged: CustomStyle = {};
        const keys = Object.keys(defaultStyle) as Array<keyof CustomStyle>;

        for (const key of keys) {
            merged[key] = { ...defaultStyle[key] } as any;
        }

        for (const styleObj of styles) {
            if (styleObj && typeof styleObj === "object") {
                for (const key of keys) {
                    if (styleObj[key] && typeof styleObj[key] === "object") {
                        merged[key] = {
                            ...merged[key],
                            ...styleObj[key]
                        } as any;
                    }
                }
            }
        }
        return merged;
    } catch (error) {
        console.debug("mergeStyles failed, using defaultStyle", error);
        return defaultStyle;
    }
}

interface State {
    otpValue: string;
    isFocused: boolean;
    autoFilled: boolean;
    listening: boolean;
    appHash?: string;
}

export class OtpInput extends Component<OtpInputProps<CustomStyle>, State> {
    private inputRef: TextInput | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    // FIX: Mounted flag to guard setState in async callbacks
    private _mounted: boolean = false;

    constructor(props: OtpInputProps<CustomStyle>) {
        super(props);
        const initialVal = props.otpValue?.value || "";
        this.state = {
            otpValue: initialVal.replace(/\D/g, "").substring(0, props.otpLength || 6),
            isFocused: false,
            autoFilled: false,
            listening: false
        };
    }

    // ── Lifecycle ────────────────────────────────────────────

    componentDidMount(): void {
        this._mounted = true;
        this.startListening();
    }

    componentDidUpdate(prev: OtpInputProps<CustomStyle>): void {
        const val = this.props.otpValue?.value;
        const prevVal = prev.otpValue?.value;

        if (val !== undefined && val !== prevVal && val !== this.state.otpValue) {
            const clean = (val || "").replace(/\D/g, "").substring(0, this.props.otpLength || 6);

            // Guard against double-fire — only update if value truly differs from current state
            if (clean !== this.state.otpValue) {
                // Mark autoFilled=true if the value arriving externally is a complete OTP.
                // If it is cleared or shortened, reset autoFilled to false.
                const isAuto = clean.length === (this.props.otpLength || 6);
                this.setState({ otpValue: clean, autoFilled: isAuto }, () => {
                    if (clean.length === (this.props.otpLength || 6)) {
                        if (this.props.onComplete?.canExecute) {
                            this.props.onComplete.execute();
                        }
                    }
                });
            }
        }

        const consoleAppHashVal = this.props.consoleAppHash && this.props.consoleAppHash.value;
        const prevConsoleAppHashVal = prev.consoleAppHash && prev.consoleAppHash.value;
        if (consoleAppHashVal === true && prevConsoleAppHashVal !== true && this.state.appHash) {
            console.info("OTP Input Android App Hash:", this.state.appHash);
        }
    }

    componentWillUnmount(): void {
        // FIX: Set flag before any async work so in-flight callbacks bail out
        this._mounted = false;
        this.stopListening();
    }

    // ── OTP listening using react-native-otp-verify ──────────

    startListening(): void {
        if (Platform.OS === "android") {
            this.startAndroidSmsListener();
            this.logAndroidAppHash();
        }
        // NOTE: On iOS, OTP auto-fill is handled natively by the OS via
        // textContentType="oneTimeCode" on the hidden TextInput. No native module needed.
        // When the backend sends an OTP via deep link and the nanoflow sets otpValue,
        // componentDidUpdate picks it up and sets autoFilled=true automatically.
    }

    logAndroidAppHash(): void {
        if (!getHash) {
            return;
        }
        getHash()
            .then((hash: string[]) => {
                // FIX: Guard setState — component may have unmounted before promise resolves
                if (!this._mounted) {
                    return;
                }
                const appHash = hash[0];
                this.setState({ appHash });
                if (this.props.consoleAppHash && this.props.consoleAppHash.value === true) {
                    console.info("OTP Input Android App Hash:", appHash);
                }
            })
            .catch((err: any) => console.warn("OTP Input: Error getting App Hash", err));
    }

    startAndroidSmsListener(): void {
        if (!OtpVerify) {
            return;
        }

        // FIX: Remove any existing listener before (re-)starting to prevent stale
        // closures and double-fire on component re-mount (e.g. after navigation)
        try {
            OtpVerify.removeListener();
        } catch (error) {
            console.debug("OtpVerify.removeListener failed", error);
        }

        try {
            OtpVerify.getOtp()
                .then(() => {
                    // FIX: Guard — component may have unmounted before promise resolves
                    if (!this._mounted) {
                        return;
                    }

                    OtpVerify.addListener((message: string) => {
                        // FIX: Inner guard too — listener fires asynchronously
                        if (!this._mounted) {
                            return;
                        }

                        try {
                            if (message && message !== "Timeout Error") {
                                // FIX: Try keyword-anchored regex first, fall back to positional
                                const match = message.match(OTP_REGEX) || message.match(OTP_FALLBACK_REGEX);
                                if (match) {
                                    // OTP_REGEX captures group 1; OTP_FALLBACK_REGEX also group 1
                                    this.distributeOtp(match[1], true);
                                    this.stopListening();
                                }
                            }
                        } catch (error) {
                            console.warn("OTP Input: Error parsing SMS message", error);
                        }
                    });

                    if (this._mounted) {
                        this.setState({ listening: true });
                    }
                })
                .catch((error: any) => {
                    console.warn("OTP Input: Error starting OTP listener", error);
                });

            // NOTE: smsTimeout controls JS-side cleanup only.
            // The Android SMS Retriever session is always 5 minutes at the OS level
            // regardless of this value — shorter values here only stop JS processing early.
            const timeoutSeconds = this.props.smsTimeout && this.props.smsTimeout > 0 ? this.props.smsTimeout : 300;
            this.timeoutId = setTimeout(() => this.stopListening(), timeoutSeconds * 1000);
        } catch (error) {
            console.debug("SMS Retriever is not available", error);
        }
    }

    stopListening(): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        try {
            if (OtpVerify) {
                OtpVerify.removeListener();
            }
        } catch (error) {
            console.debug("OtpVerify.removeListener failed", error);
        }

        // FIX: Guard setState — stopListening may be called after unmount
        if (this._mounted) {
            this.setState({ listening: false });
        }
    }

    // ── OTP fill logic ───────────────────────────────────────

    distributeOtp(otp: string, isAuto: boolean): void {
        const len = this.props.otpLength || 6;
        const finalOtp = otp.replace(/\D/g, "").substring(0, len);

        this.setState({ otpValue: finalOtp, autoFilled: isAuto }, () => {
            this.pushToMendix(finalOtp);

            if (this.props.onChange?.canExecute) {
                this.props.onChange.execute();
            }

            if (finalOtp.length === len) {
                Keyboard.dismiss();
                if (this.inputRef) {
                    this.inputRef.blur();
                }
                if (this.props.onComplete?.canExecute) {
                    this.props.onComplete.execute();
                }
            }
        });
    }

    pushToMendix(value: string): void {
        // Prevent editing read-only values in Mendix
        if (this.props.otpValue?.status === ValueStatus.Available && !this.props.otpValue.readOnly) {
            this.props.otpValue.setValue(value);
        }
    }

    // ── Input Event Handlers ─────────────────────────────────

    handleTextChange = (text: string): void => {
        const len = this.props.otpLength || 6;
        const cleaned = text.replace(/\D/g, "").substring(0, len);

        // Prevent redundant state updates
        if (cleaned === this.state.otpValue) {
            return;
        }

        this.setState({ otpValue: cleaned, autoFilled: false }, () => {
            this.pushToMendix(cleaned);

            if (this.props.onChange?.canExecute) {
                this.props.onChange.execute();
            }

            if (cleaned.length === len) {
                Keyboard.dismiss();
                if (this.inputRef) {
                    this.inputRef.blur();
                }
                if (this.props.onComplete?.canExecute) {
                    this.props.onComplete.execute();
                }
            }
        });
    };

    handlePress = (): void => {
        if (this.inputRef) {
            this.inputRef.focus();
        }
    };

    handleFocus = (): void => {
        this.setState({ isFocused: true });
    };

    handleBlur = (): void => {
        this.setState({ isFocused: false });
    };

    // ── Render ───────────────────────────────────────────────

    render(): ReactNode {
        const { otpValue, autoFilled, isFocused } = this.state;
        const len = this.props.otpLength || 6;
        const mergedStyle = mergeStyles(this.props.style);

        // Generate box slots
        const boxes = [];
        for (let i = 0; i < len; i++) {
            const char = otpValue[i] || "";
            const isCurrentBoxFocused =
                isFocused && (otpValue.length === i || (otpValue.length === len && i === len - 1));

            const displayChar = char
                ? this.props.secureTextEntry
                    ? "•"
                    : char
                : this.props.placeholderChar
                    ? this.props.placeholderChar.substring(0, 1)
                    : "";

            boxes.push(
                <View
                    key={i}
                    style={[
                        mergedStyle.box,
                        char ? mergedStyle.boxFilled : null,
                        autoFilled ? mergedStyle.boxAuto : null,
                        isCurrentBoxFocused ? mergedStyle.boxFocused : null
                    ]}
                >
                    <Text style={[mergedStyle.boxText, isCurrentBoxFocused ? mergedStyle.boxTextFocused : null]}>
                        {displayChar}
                    </Text>
                </View>
            );
        }

        const resolvedHint = this.props.customHint
            ? this.props.customHint
            : autoFilled
                ? "OTP filled automatically."
                : "Enter the OTP sent to your registered contact";

        return (
            <View style={mergedStyle.container}>
                {/* Auto-filled Badge */}
                {this.props.showBadge && autoFilled && (
                    <View style={mergedStyle.badge}>
                        <Text style={mergedStyle.badgeText}>{this.props.badgeText || "Auto-filled"}</Text>
                    </View>
                )}

                {/* OTP Boxes Row */}
                <Pressable onPress={this.handlePress} style={mergedStyle.row}>
                    {boxes}
                </Pressable>

                {/* Hidden source-of-truth TextInput */}
                <TextInput
                    ref={ref => {
                        this.inputRef = ref;
                    }}
                    value={otpValue}
                    onChangeText={this.handleTextChange}
                    onFocus={this.handleFocus}
                    onBlur={this.handleBlur}
                    keyboardType="number-pad"
                    maxLength={len}
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    autoFocus={this.props.autoFocus}
                    style={{
                        position: "absolute",
                        width: 1,
                        height: 1,
                        opacity: 0,
                        zIndex: -1
                    }}
                />

                {/* Hint Text */}
                {this.props.showHint && <Text style={mergedStyle.hint}>{resolvedHint}</Text>}

                {/* App Hash Helper Text */}
                {this.props.consoleAppHash && this.props.consoleAppHash.value === true && this.state.appHash && (
                    <Text style={[mergedStyle.hint, { marginTop: 6, fontWeight: "500" }]}>
                        {`App Hash: ${this.state.appHash}`}
                    </Text>
                )}
            </View>
        );
    }
}
