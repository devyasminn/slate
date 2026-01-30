import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

interface EmptyProfileStateProps {
    onCreateProfile: () => void;
}

export function EmptyProfileState({ onCreateProfile }: EmptyProfileStateProps) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center select-none">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-gray-200">No profile defined</h2>
                <p className="text-gray-400 text-sm">
                    Create a profile to start customizing buttons.
                </p>
            </div>

            <button
                className="btn btn-primary px-6 py-2.5 flex items-center gap-2"
                onClick={onCreateProfile}
            >
                <FontAwesomeIcon icon={faPlus} />
                Create Profile
            </button>
        </div>
    );
}
