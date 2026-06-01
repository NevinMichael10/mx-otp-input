import { Component } from "react";
import {
    View, TextInput, Text, Pressable,
    Platform, Keyboard, ViewStyle, TextStyle
} from "react-native";
import { ValueStatus } from "mendix";
// Dynamically require react-native-sms-retriever only on Android to prevent load-time crashes on iOS, web, or simulators where native modules are missing.
let SmsRetriever: any = null;
if (Platform.OS === "android") {
    try {
        const smsRetrieverModule = require("react-native-sms-retriever");
        SmsRetriever = smsRetrieverModule.default || smsRetrieverModule;
    } catch (e) {
        console.warn("OTP Input: Failed to load react-native-sms-retriever module dynamically.", e);
    }
}
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
    row: { flexDirection: "row", gap: 10, justifyContent: "center" },
    box: {
        width: 46,
        height: 54,
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
        if (val !== undefined && val !== prevVal) {
            const cleanVal = val.replace(/\D/g, "").substring(0, this.props.otpLength || 6);
            if (cleanVal !== this.state.otpValue) {
                this.setState({ otpValue: cleanVal });
            }
        }
    }

    componentWillUnmount() {
        this.stopListening();
    }

    // ── SMS / OTP listening ──────────────────────────────────

    startListening() {
        if (Platform.OS === "android") {
            this.startAndroidSmsListener();
            this.logAndroidAppHash();
        }
    }

    logAndroidAppHash() {
        if (!this.props.consoleAppHash) {
            return;
        }

        try {
            if (SmsRetriever && typeof (SmsRetriever as any).getAppHash === "function") {
                (SmsRetriever as any).getAppHash()
                    .then((hash: string) => console.error("OTP Input Android App Hash:", hash))
                    .catch((err: any) => console.error("OTP Input: Error invoking getAppHash()", err));
            } else {
                console.error("OTP Input: SmsRetriever library or getAppHash method is not available.");
            }
        } catch (e) {
            console.error("OTP Input: Exception while fetching App Hash", e);
        }
    }

    startAndroidSmsListener() {
        if (!SmsRetriever) {
            return;
        }

        try {
            SmsRetriever.startSmsRetriever()
                .then((registered: boolean) => {
                    if (registered) {
                        SmsRetriever.addSmsListener((event: any) => {
                            if (event && event.message) {
                                const match = event.message.match(OTP_REGEX);
                                if (match) {
                                    this.distributeOtp(match[1], true);
                                    this.stopListening();
                                }
                            }
                        });
                        this.setState({ listening: true });
                    }
                })
                .catch((e: any) => {
                    console.warn("OTP Input: Error starting SMS retriever client", e);
                });

            this.timeoutId = setTimeout(() => this.stopListening(), 5 * 60 * 1000);
        } catch (e) {
            // Silent fallback
        }
    }

    stopListening() {
        clearTimeout(this.timeoutId);
        try {
            if (SmsRetriever) {
                SmsRetriever.removeSmsListener();
            }
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
        if (this.props.otpValue?.status === ValueStatus.Available) {
            this.props.otpValue.setValue(value);
        }
    }

    // ── Input Event Handlers ─────────────────────────────────

    handleTextChange = (text: string) => {
        const len = this.props.otpLength || 6;
        const cleaned = text.replace(/\D/g, "").substring(0, len);

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
            </View>
        );
    }
}