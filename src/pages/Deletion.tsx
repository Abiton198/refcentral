import React, { useEffect } from "react";
import { ShieldCheck, Mail, Trash2, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DataDeletion: React.FC = () => {
    const lastUpdated: string = "October 24, 2025";

    const navigate = useNavigate();

    const BackHomeButton = () => (
        <button
            onClick={() => navigate("/")}
            className="block mx-auto mt-6 text-sm text-gray-500 underline hover:text-emerald-600 transition"
        >
            ← Back to Home
        </button>
    );

    useEffect(() => {
        document.title = "Data Deletion Request | EPRU Referees Society";
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 mt-20">
            <div className="flex justify-end"> {BackHomeButton()} </div>
            {/* Navigation / Header */}
            <nav className="bg-white border-b py-4">
                <div className="max-w-4xl mx-auto px-6 flex items-center gap-2">
                    <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                        <ShieldCheck size={20} />
                    </div>
                    <span className="font-bold text-xl tracking-tight">
                        EPRU Referees Society
                    </span>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-12">

                {/* Page Header */}
                <header className="mb-10 text-center md:text-left">
                    <h1 className="text-4xl font-extrabold mb-4 text-slate-900">
                        Account & Data Deletion
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Last Updated: {lastUpdated}
                    </p>
                </header>

                {/* Policy Section */}
                <section className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Trash2 className="text-red-500" />
                        Our Deletion Policy
                    </h2>

                    <p className="text-slate-600 mb-6 leading-relaxed">
                        At <strong>EPRU Referees Society </strong>, we believe you should
                        have full control over your data. When you request to delete your
                        account, we initiate a process to permanently remove your personal
                        information from our active systems.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">

                        {/* Deleted Data */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <h3 className="font-bold mb-2 text-slate-800">
                                Data That Is Deleted
                            </h3>
                            <ul className="text-sm text-slate-600 space-y-2 list-disc ml-4">
                                <li>Full name and profile information</li>
                                <li>Email address and contact details</li>
                                <li>Academic progress and quiz results</li>
                                <li>Career vision and interests data</li>
                                <li>Profile images and uploaded media</li>
                            </ul>
                        </div>

                        {/* Retained Data */}
                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-100">
                            <h3 className="font-bold mb-2 text-amber-900">
                                Data We May Retain
                            </h3>
                            <ul className="text-sm text-amber-800 space-y-2 list-disc ml-4">
                                <li>
                                    Subscription & billing history (retained for tax compliance)
                                </li>
                                <li>Aggregated, non-identifiable usage statistics</li>
                                <li>Logs of deletion requests for security audits</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Deletion Steps */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">
                        How to Request Deletion
                    </h2>

                    <div className="space-y-4">

                        {/* Step 1 */}
                        <div className="flex gap-4 items-start bg-white p-6 rounded-xl border shadow-sm">
                            <div className="bg-blue-100 text-blue-600 font-bold rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                1
                            </div>
                            <div>
                                <h4 className="font-bold">Via the App</h4>
                                <p className="text-slate-600 text-sm mt-1">
                                    Log in to your account. Navigate to <strong>Settings</strong>{" "}
                                    &gt; <strong>Account</strong> and select{" "}
                                    <strong>"Request Account Deletion"</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-4 items-start bg-white p-6 rounded-xl border shadow-sm">
                            <div className="bg-blue-100 text-blue-600 font-bold rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                                2
                            </div>
                            <div>
                                <h4 className="font-bold">Via Email</h4>
                                <p className="text-slate-600 text-sm mt-1 flex items-center gap-2">
                                    <Mail size={16} />
                                    Send an email to{" "}
                                    <span className="text-blue-600 font-bold">
                                        nextgenskills96@gmail.com
                                    </span>{" "}
                                    from your registered email address.
                                </p>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Info Cards */}
                <section className="grid md:grid-cols-2 gap-6 mb-12">

                    <div className="flex items-center gap-4 bg-white p-6 rounded-xl border">
                        <Clock className="text-blue-500 shrink-0" />
                        <div>
                            <h4 className="font-bold text-sm">Processing Time</h4>
                            <p className="text-xs text-slate-500">
                                Processed within 7 business days.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-6 rounded-xl border">
                        <AlertCircle className="text-blue-500 shrink-0" />
                        <div>
                            <h4 className="font-bold text-sm">Identity Verification</h4>
                            <p className="text-xs text-slate-500">
                                We may verify ownership to prevent unauthorized deletion.
                            </p>
                        </div>
                    </div>

                </section>
            </main>
        </div>
    );
};

export default DataDeletion;