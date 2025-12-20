import React from 'react';

export const LoginFooter: React.FC = () => {
    return (
        <p className="text-center text-gray-600 text-sm mt-6">
            Powered by{' '}
            <a
                href="https://github.com/ack-solutions/packages"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 font-medium"
            >
                @ackplus/nest-auth
            </a>
        </p>
    );
};
