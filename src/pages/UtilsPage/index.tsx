import { useState, useEffect, useRef } from 'react';
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

    // ── Gzip ──────────────────────────────────────────────────────────────────
    const [gzipInput, setGzipInput] = useState('');
    const [gzipOutput, setGzipOutput] = useState('');
    const [gzipError, setGzipError] = useState<string | null>(null);
    const [gzipLoading, setGzipLoading] = useState(false);

    /** Returns true when the trimmed string looks like a Base64-encoded gzip. */
    const isGzipBase64 = (value: string): boolean => {
        const trimmed = value.trim();
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) return false;
        try {
            const binary = atob(trimmed);
            // gzip magic bytes: 0x1f 0x8b
            return binary.charCodeAt(0) === 0x1f && binary.charCodeAt(1) === 0x8b;
        } catch {
            return false;
        }
    };

    const gzipDetectedMode = gzipInput.trim()
        ? isGzipBase64(gzipInput) ? 'decompress' : 'compress'
        : null;

    // Accept optional value so auto-effect can pass latest input without stale closure
    const handleGzipCompress = async (inputValue = gzipInput): Promise<void> => {
        if (!inputValue.trim()) return;
        setGzipLoading(true);
        setGzipError(null);
        try {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(inputValue);
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const compressed = await new Response(cs.readable).arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)));
            setGzipOutput(base64);
        } catch (e) {
            setGzipError(e instanceof Error ? e.message : 'Compression failed');
        } finally {
            setGzipLoading(false);
        }
    };

    const handleGzipDecompress = async (inputValue = gzipInput): Promise<void> => {
        if (!inputValue.trim()) return;
        setGzipLoading(true);
        setGzipError(null);
        try {
            const binary = atob(inputValue.trim());
            const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const decompressed = await new Response(ds.readable).arrayBuffer();
            const text = new TextDecoder().decode(decompressed);
            setGzipOutput(text);
        } catch (e) {
            setGzipError(
                e instanceof Error
                    ? e.message
                    : 'Decompression failed — make sure the input is a valid Base64-encoded gzip string',
            );
        } finally {
            setGzipLoading(false);
        }
    };

    const handleGzipSwitch = () => {
        skipAutoRef.current = true; // don't auto-run when we programmatically swap
        setGzipInput(gzipOutput);
        setGzipOutput(gzipInput);
        setGzipError(null);
    };

    const handleClearGzip = () => {
        setGzipInput('');
        setGzipOutput('');
        setGzipError(null);
    };

    const handleGzipAuto = async (inputValue = gzipInput): Promise<void> => {
        if (isGzipBase64(inputValue)) {
            await handleGzipDecompress(inputValue);
        } else {
            await handleGzipCompress(inputValue);
        }
    };

    // Track whether a change came from the swap button so we skip the auto-effect
    const skipAutoRef = useRef(false);

    // Debounced auto-run: fires 300 ms after the user stops typing
    useEffect(() => {
        if (!gzipInput.trim()) {
            setGzipOutput('');
            setGzipError(null);
            return;
        }
        if (skipAutoRef.current) {
            skipAutoRef.current = false;
            return;
        }
        const timer = setTimeout(() => {
            handleGzipAuto(gzipInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [gzipInput]); // eslint-disable-line react-hooks/exhaustive-deps

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

            {/* ── Gzip Compress / Decompress ───────────────────────────────────────── */}
            <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                    <div>
                        <h3 className="text-xl font-semibold">Gzip Compress / Decompress</h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                            Paste anything — auto-detects whether to compress or decompress.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleGzipAuto()}
                            disabled={!gzipInput.trim() || gzipLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                            {gzipLoading
                                ? '⏳ Working…'
                                : gzipDetectedMode === 'decompress'
                                    ? '📂 Decompress'
                                    : '📦 Compress'}
                        </button>
                        <button
                            onClick={() => handleGzipCompress()}
                            disabled={!gzipInput.trim() || gzipLoading}
                            className="px-3 py-2 bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                            title="Force compress"
                        >
                            Force 📦
                        </button>
                        <button
                            onClick={() => handleGzipDecompress()}
                            disabled={!gzipInput.trim() || gzipLoading}
                            className="px-3 py-2 bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                            title="Force decompress"
                        >
                            Force 📂
                        </button>
                        <button
                            onClick={handleGzipSwitch}
                            disabled={!gzipOutput}
                            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 hover:text-gray-900"
                            title="Swap input ↔ output"
                        >
                            ⇄
                        </button>
                        <button
                            onClick={handleClearGzip}
                            className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {gzipError && (
                    <div className="mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {gzipError}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            Input
                            {gzipDetectedMode === 'decompress' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                    🔍 Detected: gzip Base64 → will decompress
                                </span>
                            )}
                            {gzipDetectedMode === 'compress' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    🔍 Detected: plain text → will compress
                                </span>
                            )}
                        </label>
                        <textarea
                            value={gzipInput}
                            onChange={(e) => {
                                setGzipInput(e.target.value);
                                setGzipError(null);
                            }}
                            placeholder={'Paste plain text here to compress,\nor a Base64 gzip string here to decompress.'}
                            className="w-full h-48 font-mono text-sm border border-gray-300 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-700">
                            Output <span className="text-gray-400 font-normal">(Base64 gzip after compress, or plain text after decompress)</span>
                        </label>
                        <textarea
                            value={gzipOutput}
                            readOnly
                            placeholder="Result appears here"
                            className="w-full h-48 font-mono text-sm border border-gray-200 rounded-lg p-3 resize-y bg-gray-50 text-gray-800 focus:outline-none"
                            spellCheck={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
