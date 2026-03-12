// utils/validators.js

export const validateMakFormat = (mak) => {
    if (!mak) return false;
    
    const parts = mak.split('.');
    if (parts.length !== 6) return false;
    
    const [part1, part2, part3, part4, part5, part6] = parts;
    
    return (
        part1.length === 4 && /^[A-Z0-9]{4}$/.test(part1) &&
        part2.length === 3 && /^[A-Z0-9]{3}$/.test(part2) &&
        part3.length === 3 && /^[A-Z0-9]{3}$/.test(part3) &&
        part4.length === 3 && /^[A-Z0-9]{3}$/.test(part4) &&
        part5.length === 6 && /^[0-9]{6}$/.test(part5) &&
        part6.length === 1 && /^[A-Z]$/.test(part6)
    );
};

export const getMakPlaceholder = () => {
    const positions = [4, 7, 10, 13, 19, 20];
    let placeholder = '';
    
    for (let i = 0; i < 20; i++) {
        if (positions.includes(i)) {
            placeholder += '.';
        } else {
            placeholder += 'X';
        }
    }
    return placeholder + 'X';
};

export const formatMakInput = (value) => {
    value = value.toUpperCase();
    value = value.replace(/[^A-Z0-9.]/g, '');
    
    if (value.length > 29) {
        value = value.substring(0, 29);
    }
    
    const rawValue = value.replace(/\./g, '');
    let formatted = '';
    
    for (let i = 0; i < rawValue.length; i++) {
        if (i === 4 || i === 7 || i === 10 || i === 13 || i === 19) {
            formatted += '.';
        }
        formatted += rawValue[i];
    }
    
    return formatted;
};