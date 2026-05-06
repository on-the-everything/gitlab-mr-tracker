import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Format, FORMAT_HANDLERS, convert, pretty } from '../../utils/formatConverter';

const FORMAT_OPTIONS = Object.entries(FORMAT_HANDLERS) as [Format, (typeof FORMAT_HANDLERS)[Format]][];

export default function UtilsPage() {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [inputFormat, setInputFormat] = useState<Format>('json');
    const [outputFormat, setOutputFormat] = useState<Format>('dotenv');
    const [error, setError] = useState<string | null>(null);
    const [urlText, setUrlText] = useState('');
    const [urlOutput, setUrlOutput] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);

    const handlePretty = () => {
        if (!inputText.trim()) return;
        try {
            setInputText(pretty(inputText, inputFormat));
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to format input');
        }
    };

    const handleConvert = () => {
        if (!inputText.trim()) return;
        try {
            setOutputText(convert(inputText, inputFormat, outputFormat));
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Conversion failed');
        }
    };

    const handleSwitch = () => {
        setInputFormat(outputFormat);
        setOutputFormat(inputFormat);
        setInputText(outputText);
        setOutputText(inputText);
        setError(null);
    };

    const handleEncodeUrl = () => {
        if (!urlText.trim()) return;
        try {
            setUrlOutput(encodeURI(urlText));
            setUrlError(null);
        } catch (e) {
            setUrlError(e instanceof Error ? e.message : 'Failed to encode URL');
        }
    };

    const handleDecodeUrl = () => {
        if (!urlText.trim()) return;
        try {
            setUrlOutput(decodeURI(urlText));
            setUrlError(null);
        } catch (e) {
            setUrlError(e instanceof Error ? e.message : 'Failed to decode URL');
        }
    };

    const handleClearUrl = () => {
        setUrlText('');
        setUrlOutput('');
        setUrlError(null);
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Utils</h2>
                <Link to="/" className="text-sm text-blue-600 hover:underline">← Back to dashboard</Link>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={handlePretty}
                    disabled={!inputText.trim()}
                    className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    ✨ Pretty
                </button>
                <button
                    onClick={handleConvert}
                    disabled={!inputText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    Convert →
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Panels */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                {/* Input panel */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Input</label>
                        <select
                            value={inputFormat}
                            onChange={(e) => setInputFormat(e.target.value as Format)}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {FORMAT_OPTIONS.map(([key, handler]) => (
                                <option key={key} value={key}>{handler.label}</option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        value={inputText}
                        onChange={(e) => {
                            setInputText(e.target.value);
                            setError(null);
                        }}
                        placeholder={inputFormat === 'json' ? '{\n  "KEY": "value"\n}' : 'KEY=value\nANOTHER_KEY=other value'}
                        className="w-full h-96 font-mono text-sm border border-gray-300 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                        spellCheck={false}
                    />
                </div>

                {/* Switch button */}
                <div className="flex items-center justify-center md:mt-8">
                    <button
                        onClick={handleSwitch}
                        className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
                        title="Switch input ↔ output"
                    >
                        ⇄
                    </button>
                </div>

                {/* Output panel */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Output</label>
                        <select
                            value={outputFormat}
                            onChange={(e) => setOutputFormat(e.target.value as Format)}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {FORMAT_OPTIONS.map(([key, handler]) => (
                                <option key={key} value={key}>{handler.label}</option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        value={outputText}
                        readOnly
                        placeholder="Output will appear here after conversion"
                        className="w-full h-96 font-mono text-sm border border-gray-200 rounded-lg p-3 resize-y bg-gray-50 text-gray-800 focus:outline-none"
                        spellCheck={false}
                    />
                </div>
            </div>

            <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-semibold">URL Encoder</h3>
                        <p className="text-sm text-slate-600">Encode or decode URLs for query strings, paths, and full links.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleEncodeUrl}
                            disabled={!urlText.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            Encode URL
                        </button>
                        <button
                            onClick={handleDecodeUrl}
                            disabled={!urlText.trim()}
                            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            Decode URL
                        </button>
                        <button
                            onClick={handleClearUrl}
                            className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {urlError && (
                    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {urlError}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">URL Input</label>
                        <textarea
                            value={urlText}
                            onChange={(e) => {
                                setUrlText(e.target.value);
                                setUrlError(null);
                            }}
                            placeholder="https://example.com/path?query=hello world#section"
                            className="w-full h-48 font-mono text-sm border border-gray-300 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">Encoded / Decoded Output</label>
                        <textarea
                            value={urlOutput}
                            readOnly
                            placeholder="Results appear here after encoding or decoding"
                            className="w-full h-48 font-mono text-sm border border-gray-200 rounded-lg p-3 resize-y bg-gray-50 text-gray-800 focus:outline-none"
                            spellCheck={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
