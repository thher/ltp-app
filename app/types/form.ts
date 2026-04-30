// Form-related types

export type FormField = 'allowedAxleLoads' | 'axleOwnWeights' | 'axleDistances' | 'grossOwnWeightWithDriver';

export type FormState = Record<FormField, string>;
