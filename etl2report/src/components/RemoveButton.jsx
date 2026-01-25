export default function RemoveButton({ onClick, title = "Remove" }) {
    return (
        <button
            onClick={onClick}
            className="flex-shrink-0 text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
            title={title}
        >
            <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    );
}
