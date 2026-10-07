import React, { useState } from "react";
import { MdArrowForward, MdArrowBack, MdCheck } from "react-icons/md";
import type { EventFormData } from "@/utils/validation/EventValidation";

export type EventWizardProps = {
  initialData?: Partial<EventFormData>;
  loading: boolean;
  generalError?: string;
  onSave: (data: EventFormData) => void | Promise<void>;
  onCancel: () => void;
};

const STEPS = ["Informações Básicas", "Data e Horário", "Mídia e Links"];

export function EventWizard({ initialData, loading, generalError, onSave, onCancel }: EventWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<Partial<EventFormData>>({
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof EventFormData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateStep = (stepIndex: number) => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (stepIndex === 0) {
      if (!data.title?.trim()) { newErrors.title = "Título é obrigatório"; isValid = false; }
      if (!data.description?.trim()) { newErrors.description = "Descrição é obrigatória"; isValid = false; }
      if (!data.location?.trim()) { newErrors.location = "Local é obrigatório"; isValid = false; }
    } else if (stepIndex === 1) {
      if (!data.date?.trim()) { newErrors.date = "Data é obrigatória"; isValid = false; }
      if (!data.time?.trim()) { newErrors.time = "Horário é obrigatório"; isValid = false; }
    }

    setErrors(newErrors);
    return isValid;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(currentStep)) {
      onSave(data as EventFormData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="column h-full">
      {/* Stepper Header */}
      <div className="row gap-2 p-6 bg-white/[0.03] border-b border-muted">
        {STEPS.map((step, index) => (
          <div key={step} className="row items-center gap-2 flex-1">
            <div className={`center w-8 h-8 rounded-full text-sm font-bold ${index <= currentStep ? "bg-main text-background" : "bg-muted text-muted-foreground opacity-50"}`}>
              {index + 1}
            </div>
            <span className={`text-sm hidden sm:block ${index <= currentStep ? "font-semibold" : "opacity-60"}`}>
              {step}
            </span>
            {index < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-muted mx-2" />
            )}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="p-6 flex-1 overflow-y-auto column gap-6">
        {currentStep === 0 && (
          <div className="column gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="column">
              <label htmlFor="title">Título do Evento</label>
              <input
                id="title"
                type="text"
                value={data.title}
                onChange={(e) => update("title", e.target.value)}
                className={`input ${errors.title ? "input-error" : ""}`}
                placeholder="Ex: Feira de Ciências"
              />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>
            
            <div className="column">
              <label htmlFor="description">Descrição</label>
              <textarea
                id="description"
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
                className={`input min-h-32 resize-y ${errors.description ? "input-error" : ""}`}
                placeholder="Detalhes sobre o evento..."
              />
              {errors.description && <span className="error-message">{errors.description}</span>}
            </div>

            <div className="column">
              <label htmlFor="location">Localização</label>
              <input
                id="location"
                type="text"
                value={data.location}
                onChange={(e) => update("location", e.target.value)}
                className={`input ${errors.location ? "input-error" : ""}`}
                placeholder="Ex: Auditório Principal"
              />
              {errors.location && <span className="error-message">{errors.location}</span>}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="column gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="column">
                <label htmlFor="date">Data Principal</label>
                <input
                  id="date"
                  type="date"
                  value={data.date}
                  onChange={(e) => update("date", e.target.value)}
                  className={`input ${errors.date ? "input-error" : ""}`}
                />
                {errors.date && <span className="error-message">{errors.date}</span>}
              </div>

              <div className="column">
                <label htmlFor="time">Horário de Início</label>
                <input
                  id="time"
                  type="time"
                  value={data.time}
                  onChange={(e) => update("time", e.target.value)}
                  className={`input ${errors.time ? "input-error" : ""}`}
                />
                {errors.time && <span className="error-message">{errors.time}</span>}
              </div>
            </div>
            <div className="card bg-main/10 border-main/20 text-main p-4 rounded-md text-sm">
              <p>No futuro, o agendamento multi-dias será adicionado aqui.</p>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="column gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="card center py-12 border-dashed border-muted">
              <p className="opacity-60 text-sm">Upload de Banner (Em breve)</p>
            </div>
            <div className="column">
              <label>Tags (Em breve)</label>
              <input type="text" className="input" placeholder="Selecione as tags do evento" disabled />
            </div>
            <div className="column">
              <label>Links Externos (Em breve)</label>
              <input type="url" className="input" placeholder="https://" disabled />
            </div>
          </div>
        )}
      </div>

      {generalError && (
        <div className="px-6">
          <p className="error-message p-3 bg-danger/10 rounded-md">{generalError}</p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="row gap-3 p-6 border-t border-muted bg-white/[0.03] mt-auto">
        {currentStep > 0 ? (
          <button type="button" onClick={prevStep} disabled={loading} className="button clean">
            <MdArrowBack className="icon" /> Voltar
          </button>
        ) : (
          <button type="button" onClick={onCancel} disabled={loading} className="button clean text-danger">
            Cancelar
          </button>
        )}

        <div className="flex-1" />

        {currentStep < STEPS.length - 1 ? (
          <button type="button" onClick={nextStep} className="button main">
            Avançar <MdArrowForward className="icon" />
          </button>
        ) : (
          <button type="submit" disabled={loading} className="button main">
            {loading ? "Salvando..." : "Publicar Evento"} <MdCheck className="icon" />
          </button>
        )}
      </div>
    </form>
  );
}
