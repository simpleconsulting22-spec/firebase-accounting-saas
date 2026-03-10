import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error("React crash:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: { padding: 20, color: "red" }, children: [_jsx("h2", { children: "Application Crash Detected" }), _jsx("pre", { children: this.state.error?.message })] }));
        }
        return this.props.children;
    }
}
