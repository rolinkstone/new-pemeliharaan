// components/common/StatusBadge.js
import React from 'react';

const StatusBadge = ({ status }) => {
    switch (status) {
        case 'draft':
            return (
                <span className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-medium rounded-full">
                    Draft
                </span>
            );
        case 'diajukan':
            return (
                <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-medium rounded-full">
                    Diajukan
                </span>
            );
        case 'disetujui':
            return (
                <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-medium rounded-full">
                    Disetujui
                </span>
            );
        case 'dikembalikan':
            return (
                <span className="px-2 py-1 bg-red-200 text-red-800 text-xs font-medium rounded-full">
                    Dikembalikan
                </span>
            );
        case 'diketahui':
            return (
                <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-medium rounded-full">
                    Diketahui Kabalai
                </span>
            );
        default:
            return (
                <span className="px-2 py-1 bg-gray-200 text-gray-800 text-xs font-medium rounded-full">
                    Unknown
                </span>
            );
    }
};

export default StatusBadge;