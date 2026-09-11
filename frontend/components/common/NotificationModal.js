// components/kegiatan/NotificationModal.js
const NotificationModal = ({ show, message, onClose }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="px-6 py-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-lg font-medium text-gray-900">Informasi</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">{message}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;