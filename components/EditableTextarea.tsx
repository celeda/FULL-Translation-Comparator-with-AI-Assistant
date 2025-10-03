import React, { useState, useEffect } from 'react';

interface EditableTextareaProps {
    initialValue: string;
    onSave: (newValue: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    rows?: number;
}

export const EditableTextarea: React.FC<EditableTextareaProps> = ({
    initialValue,
    onSave,
    placeholder = "",
    disabled = false,
    className = "w-full bg-gray-900/50 border border-gray-700 rounded-md p-1.5 text-gray-200 resize-y",
    rows = 2
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleBlur = () => {
        if (value !== initialValue) {
            onSave(value);
        }
    };

    return (
        <textarea
            rows={rows}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            className={className}
            placeholder={placeholder}
            disabled={disabled}
        />
    );
};
