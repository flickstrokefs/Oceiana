export interface ColorRange {
  id: string;
  min: number;
  max: number;
  color: string;
}

export interface ColorRangeValidationIssue {
  rangeId: string;
  field?: 'min' | 'max' | 'color';
  message: string;
}

export interface ColorRangeValidationResult {
  isValid: boolean;
  errors: ColorRangeValidationIssue[];
  generalError?: string;
}
