import React from 'react';
import { Link } from 'react-router-dom';

export default function FeaturePage() {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-semibold mb-4">Feature</h2>

            <section className="mb-6">
                <h3 className="text-lg font-medium">Overview</h3>
                <p className="text-sm text-gray-600 mt-2">Placeholder page for the new Feature. Use this page to describe and preview feature work.</p>
            </section>

            <section>
                <h3 className="text-lg font-medium">TODO</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 mt-2 space-y-1">
                    <li>will list later.</li>
                </ul>
            </section>

            <div className="mt-6">
                <Link to="/" className="text-sm text-blue-600 hover:underline">← Back to dashboard</Link>
            </div>
        </div>
    );
}
