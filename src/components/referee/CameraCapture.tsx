import React, { useCallback, useEffect, useRef, useState } from "react";

const MAX_SIDE = 1280; // keeps uploads well under the 5 MB backend limit

/** Downscales any image source to a JPEG blob (max 1280px on the long side). */
async function canvasToJpeg(
    source: CanvasImageSource,
    width: number,
    height: number
): Promise<Blob> {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the photo.");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the photo."))),
            "image/jpeg",
            0.85
        )
    );
}

async function fileToJpeg(file: File): Promise<Blob> {
    // imageOrientation keeps phone photos upright
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
    return canvasToJpeg(bitmap, bitmap.width, bitmap.height);
}

interface Props {
    /** "user" = front camera (selfies), "environment" = back camera (documents) */
    facing: "user" | "environment";
    onCapture: (blob: Blob, previewUrl: string) => void;
    disabled?: boolean;
    hint?: string;
}

export const CameraCapture: React.FC<Props> = ({
    facing,
    onCapture,
    disabled,
    hint,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [ready, setReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError("Live camera is not available here. Use the button below.");
            return;
        }

        navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 960 },
                },
                audio: false,
            })
            .then((stream) => {
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => undefined);
                }
                setReady(true);
            })
            .catch(() =>
                setCameraError(
                    "Camera access was blocked. Allow camera access, or use the button below."
                )
            );

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, [facing]);

    const deliver = useCallback(
        async (blob: Blob) => onCapture(blob, URL.createObjectURL(blob)),
        [onCapture]
    );

    const takePhoto = async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;
        setProcessing(true);
        try {
            await deliver(await canvasToJpeg(video, video.videoWidth, video.videoHeight));
        } finally {
            setProcessing(false);
        }
    };

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setProcessing(true);
        try {
            await deliver(await fileToJpeg(file));
        } catch {
            setCameraError("That photo could not be read. Please try another.");
        } finally {
            setProcessing(false);
        }
    };

    const busy = disabled || processing;

    return (
        <div className="space-y-3">
            {!cameraError && (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4] max-w-sm mx-auto">
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
                    />
                    {!ready && (
                        <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                            Starting camera…
                        </p>
                    )}
                </div>
            )}

            {cameraError && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    {cameraError}
                </p>
            )}

            {hint && <p className="text-xs text-gray-500 text-center">{hint}</p>}

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {!cameraError && (
                    <button
                        type="button"
                        onClick={takePhoto}
                        disabled={!ready || busy}
                        className="px-5 py-2 rounded-full bg-blue-600 text-white font-medium disabled:opacity-50"
                    >
                        {processing ? "Processing…" : "Take photo"}
                    </button>
                )}

                {/* Native camera app / gallery: the most reliable option on phones */}
                <label
                    className={`px-5 py-2 rounded-full border border-gray-300 text-gray-700 text-center cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""
                        }`}
                >
                    Use phone camera / upload
                    <input
                        type="file"
                        accept="image/*"
                        capture={facing}
                        className="hidden"
                        onChange={onFile}
                    />
                </label>
            </div>
        </div>
    );
};

export default CameraCapture;