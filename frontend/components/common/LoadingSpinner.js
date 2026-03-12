// components/common/LoadingSpinner.js
import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Memuat...' }) => {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-12 w-12',
        lg: 'h-16 w-16'
    };

    return (
        <div className="flex items-center justify-center">
            <div className="text-center">
                <div className={`animate-spin rounded-full border-b-2 border-indigo-600 mx-auto ${sizeClasses[size]}`}></div>
                {text && <p className="mt-4 text-gray-600">{text}</p>}
            </div>
        </div>
    );
};

export default LoadingSpinner;