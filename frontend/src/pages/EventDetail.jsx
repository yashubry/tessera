import React from 'react';
import { useParams } from 'react-router-dom';
import TesseraSeatPicker from 'tessera-seat-picker';


const rows = [
  [
    { id: 1, number: 1, tooltip: "$30" },
    { id: 2, number: 2, tooltip: "$30" },
    { id: 3, number: 3, isReserved: true, tooltip: "$30" },
    null,
    { id: 4, number: 4, tooltip: "$30" },
    { id: 5, number: 5, tooltip: "$30" },
    { id: 6, number: 6, tooltip: "$30" }
  ],
  [
    { id: 7, number: 1, isReserved: true, tooltip: "$20" },
    { id: 8, number: 2, isReserved: true, tooltip: "$20" },
    { id: 9, number: 3, isReserved: true, tooltip: "$20" },
    null,
    { id: 10, number: 4, tooltip: "$20" },
    { id: 11, number: 5, tooltip: "$20" },
    { id: 12, number: 6, tooltip: "$20" }
  ]
];



function EventDetail() {
  const { id } = useParams(); 
  

  return (
    <div>
      <h1>Event Detail Page</h1>
      <p>Showing details for event ID: {id}</p>
      <p>This is a placeholder page</p>

      <TesseraSeatPicker
      addSeatCallback={addSeatCallback}
      removeSeatCallback={removeSeatCallback}
      rows={rows}
      maxReservableSeats={3}
      alpha
      visible
      loading={loading}
      />

    </div>
  );
}

export default EventDetail;