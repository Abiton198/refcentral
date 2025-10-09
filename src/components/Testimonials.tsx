import React, { useState } from 'react';
import { Card } from './ui/Card';

export const Testimonials: React.FC = () => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const testimonials = [
    {
      name: 'Potie',
      role: 'Senior Referee',
      image: '/img/ref_potie.jpeg',
      quote:
        'RefCentral has transformed how we manage appointments. The digital system saves hours every week.',
    },
    {
      name: 'Fernando Utheiler',
      role: 'Executive Chairman',
      image: '/img/chairman.jpeg',
      quote:
        'Finally, a platform that understands rugby officiating. The analytics help us make better decisions.',
    },
    {
      name: 'Richard',
      role: 'EPRU Admin',
      image: '/img/epru_richard.jpeg',
      quote:
        'Submitting reports is now effortless. The structured system ensures nothing gets missed.',
    },
  ];

  return (
    <>
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Trusted by Officials</h2>
            <p className="text-xl text-gray-600">Hear from our society members</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <Card key={idx} className="text-center">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  onClick={() =>
                    setZoomedImage(
                      zoomedImage === testimonial.image ? null : testimonial.image
                    )
                  }
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-emerald-600 cursor-pointer transition-transform hover:scale-110"
                />
                <p className="text-gray-700 italic mb-4">"{testimonial.quote}"</p>
                <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                <p className="text-sm text-gray-600">{testimonial.role}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Zoomed Image Overlay */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-[9999]"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed testimonial"
            className="max-w-full max-h-full rounded-lg shadow-lg cursor-pointer"
          />
        </div>
      )}
    </>
  );
};
