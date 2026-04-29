/**
 * Ambient type declarations for the design-system JSX modules.
 *
 * The design system was originally authored in plain .jsx (no TypeScript).
 * Rather than rewriting thousands of lines, we expose every component as a
 * permissive React.FC<any> so the rest of the app (.tsx) can consume it
 * without `implicit any` errors. This keeps the door open for gradually
 * migrating individual components to typed .tsx modules in the future.
 */
import * as React from "react";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };
type AnyComponent = React.FC<AnyProps>;

declare module "../design/index.jsx" {
  export const Icons: Record<string, AnyComponent>;
  export const PageHeader: AnyComponent;
  export const StepProgress: AnyComponent;
  export const Segmented: AnyComponent;
  export const Button: AnyComponent;
  export const Card: AnyComponent;
  export const Badge: AnyComponent;
  export const Input: AnyComponent;
  export const Select: AnyComponent;
  export const StepCard: AnyComponent;
  export const Field: AnyComponent;
  export const Toggle: AnyComponent;
  export const Metric: AnyComponent;
  export const SummaryRow: AnyComponent;
  export const FormSection: AnyComponent;
  export const FormRow: AnyComponent;
  export const SectionHeader: AnyComponent;
  export const AppShell: AnyComponent;
  export const AdminScreen: AnyComponent;
  export const ContractScreen: AnyComponent;
  export const DocsScreen: AnyComponent;
  export const AiPanel: AnyComponent;
  export const ProfileModal: AnyComponent;
  // catch-all
  const _default: Record<string, AnyComponent>;
  export default _default;
}

declare module "*.jsx" {
  const value: Record<string, AnyComponent>;
  export default value;
  export const Icons: Record<string, AnyComponent>;
}
