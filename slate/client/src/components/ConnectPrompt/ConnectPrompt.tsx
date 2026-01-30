import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFingerprint } from '@fortawesome/free-solid-svg-icons';
import './ConnectPrompt.css';

export function ConnectPrompt() {
    return (
        <div className="connect-prompt">
            <div className="connect-prompt-icon">
                <FontAwesomeIcon icon={faFingerprint} />
            </div>
            <h2 className="connect-prompt-title">Authentication Required</h2>
            <p className="connect-prompt-text">
                To use Slate, scan the QR code in your desktop editor app to connect and authenticate.
            </p>
        </div>
    );
}
