import React, { useState } from "react";
import { useMemo } from "react";
import { useEffect } from "react";


interface Team {
    id: string;
    name: string;
    teams: Team[];

}

interface SearchSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Team[];
    placeholder: string;
    teams: Team[];

}

const SearchSelect: React.FC<SearchSelectProps> = ({
    value,
    onChange,
    options,
    placeholder,
    teams,
}) => {
    const [showSearch, setShowSearch] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = options.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
    );


    const [homeSearch, setHomeSearch] = useState("");
    const [awaySearch, setAwaySearch] = useState("");
    const [showHomeSearch, setShowHomeSearch] = useState(false);
    const [showAwaySearch, setShowAwaySearch] = useState(false);

    const filteredHomeTeams = useMemo(() => {
        if (!homeSearch.trim()) return teams;
        return teams.filter((t) =>
            t.name.toLowerCase().includes(homeSearch.toLowerCase())
        );
    }, [teams, homeSearch]);

    const filteredAwayTeams = useMemo(() => {
        if (!awaySearch.trim()) return teams;
        return teams.filter((t) =>
            t.name.toLowerCase().includes(awaySearch.toLowerCase())
        );
    }, [teams, awaySearch]);

    useEffect(() => {
        const handleClickOutside = () => setShowHomeSearch(false);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    return (
        <div className="w-full relative">
            {/* DISPLAY MODE */}
            {!showSearch && (
                <div
                    onClick={() => setShowSearch(true)}
                    className="w-full border rounded-lg px-4 py-2 cursor-pointer bg-white"
                >
                    {value || placeholder}
                </div>
            )}

            {/* SEARCH MODE */}
            {showSearch && (
                <div className="border rounded-lg bg-white">
                    <input
                        type="text"
                        autoFocus
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-4 py-2 border-b outline-none"
                    />

                    <div className="max-h-40 overflow-y-auto">
                        {filteredOptions.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    onChange(item.name);
                                    setSearch("");
                                    setShowSearch(false); // hide after select
                                }}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                                {item.name}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchSelect;