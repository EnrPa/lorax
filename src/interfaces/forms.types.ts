import { JSX } from "solid-js";

export interface FormProps extends JSX.HTMLAttributes<HTMLElement> {
    name: string;
}

export interface FormItem {
    children?: JSX.Element;
    name: string;
    /** Mensaje de error del campo; se muestra debajo, con ícono y texto. */
    error?: string;
}
