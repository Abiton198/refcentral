import React from 'react';
import { mockResults } from '@/data/mockResults';

export const ResultsView: React.FC = () => {
  return (
    <div className="bg-white shadow-lg rounded-xl p-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">Match Results</h3>
      <table className="min-w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 border border-gray-200 text-left">Match</th>
            <th className="px-4 py-2 border border-gray-200 text-left">Date</th>
            <th className="px-4 py-2 border border-gray-200 text-left">Referee</th>
            <th className="px-4 py-2 border border-gray-200 text-left">Score</th>
          </tr>
        </thead>
        <tbody>
          {mockResults.map((result, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-2 border border-gray-200">{result.match}</td>
              <td className="px-4 py-2 border border-gray-200">{result.date}</td>
              <td className="px-4 py-2 border border-gray-200">{result.referee}</td>
              <td className="px-4 py-2 border border-gray-200">{result.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
