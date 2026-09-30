import { Field, Input, NativeSelect } from '@chakra-ui/react';

import type { ReactNode } from 'react';

export const LabeledField = ({ children, label }: { children: ReactNode; label: ReactNode }) => (
  <Field.Root>
    <Field.Label fontWeight="medium">{label}</Field.Label>
    {children}
  </Field.Root>
);

interface SelectFieldProps {
  label: string;
  /** Shows the selected option's label as a read-only text input */
  readOnly?: boolean;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  value: string;
}

export const SelectField = ({
  label,
  onChange,
  options,
  readOnly = false,
  value,
}: SelectFieldProps) => (
  <LabeledField label={label}>
    {readOnly ? (
      <Input
        readOnly
        value={options.find(([optionValue]) => optionValue === value)?.[1] ?? value}
      />
    ) : (
      <NativeSelect.Root>
        <NativeSelect.Field
          onChange={(event) => {
            onChange(event.currentTarget.value);
          }}
          value={value}
        >
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    )}
  </LabeledField>
);
