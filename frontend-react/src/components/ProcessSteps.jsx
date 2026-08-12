import './ProcessSteps.css';

export default function ProcessSteps({ steps }) {
    if (!steps || steps.length === 0) return null;

    return (
        <div className="process-steps-container">
            <h3 className="panel-subheading">Process Steps</h3>
            <div className="process-steps">
                {steps.map((step, i) => (
                    <div key={i} className={`step-item ${step.status}`}>
                        <div className={`step-check ${step.status}`}>
                            {step.status === 'complete' ? '✓' : step.status === 'in_progress' ? '●' : ''}
                        </div>
                        <span className="step-name">{step.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
