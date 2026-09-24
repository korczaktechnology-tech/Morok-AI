/// <reference types="vite/client" />

declare module "react" {
  export const useEffect: any;
  export const useState: any;
}

declare module "react-dom/client" {
  export const createRoot: any;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      [elementName: string]: any;
    }
  }
}
