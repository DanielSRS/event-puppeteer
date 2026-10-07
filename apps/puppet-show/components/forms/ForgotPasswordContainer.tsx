'use client';

import React, { useState } from 'react';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export function ForgotPasswordContainer() {
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>();

  const handleSubmit = (email: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setSuccessMessage('Se este e-mail estiver cadastrado, você receberá um link de redefinição em breve.');
    }, 1500);
  };

  return (
    <ForgotPasswordForm 
      onSubmit={handleSubmit} 
      isLoading={isLoading} 
      successMessage={successMessage} 
    />
  );
}
