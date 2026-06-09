/**
 * This file was generated from OtpInput.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, DynamicValue, EditableValue } from "mendix";

export interface OtpInputProps<Style> {
    name: string;
    style: Style[];
    otpValue: EditableValue<string>;
    otpLength: number;
    secureTextEntry: boolean;
    autoFocus: boolean;
    placeholderChar: string;
    onComplete?: ActionValue;
    onChange?: ActionValue;
    consoleAppHash?: DynamicValue<boolean>;
    smsTimeout: number;
    resendTrigger?: EditableValue<boolean>;
    showBadge: boolean;
    badgeText: string;
    showHint: boolean;
    customHint: string;
}

export interface OtpInputPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    otpValue: string;
    otpLength: number | null;
    secureTextEntry: boolean;
    autoFocus: boolean;
    placeholderChar: string;
    onComplete: {} | null;
    onChange: {} | null;
    consoleAppHash: string;
    smsTimeout: number | null;
    resendTrigger: string;
    showBadge: boolean;
    badgeText: string;
    showHint: boolean;
    customHint: string;
}
