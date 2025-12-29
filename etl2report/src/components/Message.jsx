import { useState } from 'react';
import Button from './Button';

export default function Message({ message, isError, onClose }) {

    return (
        <div className="p-4 rounded-lg mb-2 flex justify-between items-start border border-theme-primary">
            <Button
                displayText={message}
                variant={isError ? 'error-message' : 'success-message'}
                prefix={
                    <>
                        <Button 
                            onClick={onClose}
                            variant='ghost'                         size="small"
                            displayText="×"
                            className="ml-4 font-bold text-xl leading-none"
                            aria-label="Close message"
                        />
                        &nbsp;
                    </>
                }
                    
            />
        </div>
    );
}
