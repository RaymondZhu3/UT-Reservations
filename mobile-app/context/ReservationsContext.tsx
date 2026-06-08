import { createContext, useContext, useState, ReactNode } from 'react';

type Reservation = {
    facility: string;
    date: string;
    time: string;
    court: string;
    cancelUrl: string;
}

type ReservationsContextType = {
    upcoming: Reservation[];
    past: Reservation[];
    setReservations: (upcoming: Reservation[], past: Reservation[]) => void;
}

const ReservationsContext = createContext<ReservationsContextType>({
    upcoming: [],
    past: [],
    setReservations: () => {}
});

export function ReservationsProvider({ children }: { children: ReactNode }) {
    const [upcoming, setUpcoming] = useState<Reservation[]>([]);
    const [past, setPast] = useState<Reservation[]>([]);

    function setReservations(upcoming: Reservation[], past: Reservation[]) {
        setUpcoming(upcoming);
        setPast(past);
    }

    return (
        <ReservationsContext.Provider value={{ upcoming, past, setReservations }}>
            {children}
        </ReservationsContext.Provider>
    );
}

export function useReservations() {
    return useContext(ReservationsContext);
}