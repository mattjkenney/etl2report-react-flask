import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeMessage } from '../store/messages';
import Message from './Message';

export default function MessageList() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const messages = useSelector((state) => state.messages.messages);
    const dispatch = useDispatch();
    
    if (!messages || messages.length === 0) {
        return null;
    }

    const handleRemoveMessage = (msgId) => {
        dispatch(removeMessage(msgId));
    };

    return (
        <div className={`border-b border-theme-primary bg-theme-secondary`}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full text-left p-3 flex justify-between items-center hover:bg-opacity-80 transition-colors"
            >
                <span className={`font-medium text-theme-primary`}>
                    Messages
                </span>
                <span className="text-theme-primary">
                    {isCollapsed ? '▼' : '▲'}
                </span>
            </button>
            {!isCollapsed && (
                <div className="p-4">
                    {messages.map((msg, index) => (
                        <Message
                            key={msg.id || index}
                            message={msg.message} 
                            isError={msg.isError}
                            onClose={() => handleRemoveMessage(msg.id || index)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
