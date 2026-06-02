import { Component } from "react";
import { View, TextInput, Text, Pressable, Platform, Keyboard, ViewStyle, TextStyle } from "react-native";
import { ValueStatus } from "mendix";
import OtpVerify, { getHash } from "react-native-otp-verify";

import { OtpInputProps } from "../typings/OtpInputProps";

// ── OTP regex: matches 4–8 digit codes ──────────────────────
const OTP_REGEX = /\b(\d{4,8})\b/;

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
    container: { alignItems: "center", paddingVertical: 16 },
    badge: {
        backgroundColor: "#E6F4EE",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 12
    },
    badgeText: { color: "#0F6E56", fontSize: 13, fontWeight: "500" },
    row: { flexDirection: "row", gap: 10, justifyContent: "center", width: "100%", paddingHorizontal: 16 },
    box: {
        flex: 1,
        minWidth: 32,
        maxWidth: 56,
        minHeight: 38,
        maxHeight: 66,
        aspectRatio: 46 / 54,
        borderWidth: 1.5,
        borderColor: "#C8C6BE",
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#FAFAF8"
    },
    boxFilled: { borderColor: "#1D9E75", backgroundColor: "#F0FAF6" },
    boxAuto: { borderColor: "#1D9E75", backgroundColor: "#E6F4EE" },
    boxFocused: { borderColor: "#007AFF", backgroundColor: "#F2F8FF" },
    boxText: { fontSize: 22, fontWeight: "600", color: "#1A1A18", textAlign: "center" },
    boxTextFocused: { color: "#007AFF" },
    hint: { marginTop: 14, fontSize: 13, color: "#6B6965", textAlign: "center" }
};

function mergeStyles(styles: any): CustomStyle {
    if (!styles || !Array.isArray(styles) || styles.length === 0) {
        return defaultStyle;
    }
    const merged: CustomStyle = {};
    const keys = Object.keys(defaultStyle) as Array<keyof CustomStyle>;

    for (const key of keys) {
        merged[key] = { ...defaultStyle[key] } as any;
    }

    for (const styleObj of styles) {
        if (styleObj) {
            for (const key of keys) {
                if (styleObj[key]) {
                    merged[key] = {
                        ...merged[key],
                        ...styleObj[key]
                    } as any;
                }
            }
        }
    }
    return merged;
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
    private timeoutId: any = null;

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

    componentDidMount() {
        this.startListening();
    }

    componentDidUpdate(prev: OtpInputProps<CustomStyle>) {
        const val = this.props.otpValue?.value;
        const prevVal = prev.otpValue?.value;
        if (val !== undefined && val !== prevVal && val !== this.state.otpValue) {
            const clean = val.replace(/\D/g, "").substring(0, this.props.otpLength || 6);
            this.setState({ otpValue: clean }, () => {
                if (clean.length === (this.props.otpLength || 6)) {
                    if (this.props.onComplete?.canExecute) {
                        this.props.onComplete.execute();
                    }
                }
            });
        }

        const consoleAppHashVal = this.props.consoleAppHash && this.props.consoleAppHash.value;
        const prevConsoleAppHashVal = prev.consoleAppHash && prev.consoleAppHash.value;
        if (consoleAppHashVal === true && prevConsoleAppHashVal !== true && this.state.appHash) {
            console.info("OTP Input Android App Hash:", this.state.appHash);
        }
    }

    componentWillUnmount() {
        this.stopListening();
    }

    // ── OTP listening using react-native-otp-verify ──────────

    startListening() {
        if (Platform.OS === "android") {
            this.startAndroidSmsListener();
            this.logAndroidAppHash();
        }
    }

    logAndroidAppHash() {
        getHash()
            .then((hash: string[]) => {
                const appHash = hash[0];
                this.setState({ appHash });
                if (this.props.consoleAppHash && this.props.consoleAppHash.value === true) {
                    console.info("OTP Input Android App Hash:", appHash);
                }
            })
            .catch((err: any) => console.warn("OTP Input: Error getting App Hash", err));
    }

    startAndroidSmsListener() {
        try {
            OtpVerify.getOtp()
                .then(() => {
                    OtpVerify.addListener((message: string) => {
                        try {
                            if (message && message !== "Timeout Error") {
                                const match = message.match(OTP_REGEX);
                                if (match) {
                                    this.distributeOtp(match[1], true);
                                    this.stopListening();
                                }
                            }
                        } catch (error) {
                            console.warn("OTP Input: Error parsing SMS message", error);
                        }
                    });

                    this.setState({ listening: true });
                })
                .catch((error: any) => {
                    console.warn("OTP Input: Error starting OTP listener", error);
                });

            const timeoutSeconds = this.props.smsTimeout && this.props.smsTimeout > 0 ? this.props.smsTimeout : 300;
            this.timeoutId = setTimeout(() => this.stopListening(), timeoutSeconds * 1000);
        } catch (e) {
            // Silent fallback
        }
    }

    stopListening() {
        clearTimeout(this.timeoutId);

        try {
            OtpVerify.removeListener();
        } catch (_) { }

        this.setState({ listening: false });
    }

    // ── OTP fill logic ───────────────────────────────────────

    distributeOtp(otp: string, isAuto: boolean) {
        const len = this.props.otpLength || 6;
        const finalOtp = otp.replace(/\D/g, "").substring(0, len);

        this.setState({ otpValue: finalOtp, autoFilled: isAuto }, () => {
            this.pushToMendix(finalOtp);
            if (this.props.onChange?.canExecute) {
                this.props.onChange.execute();
            }
            if (finalOtp.length === len) {
                Keyboard.dismiss();
                if (this.props.onComplete?.canExecute) {
                    this.props.onComplete.execute();
                }
            }
        });
    }

    pushToMendix(value: string) {
        // Prevent editing read-only values in Mendix
        if (this.props.otpValue?.status === ValueStatus.Available && !this.props.otpValue.readOnly) {
            this.props.otpValue.setValue(value);
        }
    }

    // ── Input Event Handlers ─────────────────────────────────

    handleTextChange = (text: string) => {
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
                if (this.props.onComplete?.canExecute) {
                    this.props.onComplete.execute();
                }
            }
        });
    };

    handlePress = () => {
        if (this.inputRef) {
            this.inputRef.focus();
        }
    };

    handleFocus = () => {
        this.setState({ isFocused: true });
    };

    handleBlur = () => {
        this.setState({ isFocused: false });
    };

    // ── Render ───────────────────────────────────────────────

    render() {
        const { otpValue, autoFilled, isFocused } = this.state;
        const len = this.props.otpLength || 6;
        const mergedStyle = mergeStyles(this.props.style);

        // Generate box slots
        const boxes = [];
        for (let i = 0; i < len; i++) {
            const char = otpValue[i] || "";
            const isCurrentBoxFocused = isFocused && (
                otpValue.length === i ||
                (otpValue.length === len && i === len - 1)
            );

            const displayChar = char
                ? (this.props.secureTextEntry ? "•" : char)
                : (this.props.placeholderChar ? this.props.placeholderChar.substring(0, 1) : "");

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
                    <Text
                        style={[
                            mergedStyle.boxText,
                            isCurrentBoxFocused ? mergedStyle.boxTextFocused : null
                        ]}
                    >
                        {displayChar}
                    </Text>
                </View>
            );
        }

        const resolvedHint = this.props.customHint
            ? this.props.customHint
            : (autoFilled
                ? "OTP filled automatically."
                : "Enter the OTP sent to your registered contact");

        return (
            <View style={mergedStyle.container}>
                {/* Auto-filled Badge */}
                {this.props.showBadge && autoFilled && (
                    <View style={mergedStyle.badge}>
                        <Text style={mergedStyle.badgeText}>
                            {this.props.badgeText || "Auto-filled"}
                        </Text>
                    </View>
                )}

                {/* OTP Boxes Row */}
                <Pressable onPress={this.handlePress} style={mergedStyle.row}>
                    {boxes}
                </Pressable>

                {/* Hidden source-of-truth TextInput */}
                <TextInput
                    ref={ref => { this.inputRef = ref; }}
                    value={otpValue}
                    onChangeText={this.handleTextChange}
                    onFocus={this.handleFocus}
                    onBlur={this.handleBlur}
                    keyboardType="number-pad"
                    maxLength={len}
                    textContentType="oneTimeCode"
                    autoComplete={Platform.OS === "android" ? "one-time-code" : "off"}
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
                {this.props.showHint && (
                    <Text style={mergedStyle.hint}>
                        {resolvedHint}
                    </Text>
                )}

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