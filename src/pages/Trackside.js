import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Trackside.css';
import { useCar } from '../context/CarContext';
import { useEvent } from '../context/EventContext';
import Modal from 'react-modal';
import { Menu, Item, contextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';
import EditableTable from '../components/EditableTable';
import PartsGrid from '../components/PartsGrid';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

Modal.setAppElement('#root'); // Set the app element for accessibility

const gridLayout = [
  ["Top Left", "Top Middle", "Top Right"],
  ["LF", "Engine", "RF"],
  ["Driver", "Center", "Passenger"],
  ["LR", "Differential", "RR"],
  ["Bottom Left", "Bottom Middle", "Bottom Right"]
];

const Trackside = () => {
  const { selectedCar: carId } = useCar();
  const { currentEvent, setCurrentEvent, currentSession, setCurrentSession } = useEvent();
  const [events, setEvents] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessions, setSessions] = useState([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedSessions, setSelectedSessions] = useState(['Practice', 'Heat', 'Feature']);
  const [showForm, setShowForm] = useState(false);
  const [showCustomSessions, setShowCustomSessions] = useState(false);
  const [parts, setParts] = useState([]);
  const [groupedParts, setGroupedParts] = useState({});
  const [values, setValues] = useState({});
  const [preSessionNotes, setPreSessionNotes] = useState([]);
  const [postSessionNotes, setPostSessionNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showTableLightbox, setShowTableLightbox] = useState(false);
  const [currentPart, setCurrentPart] = useState(null);
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCallback, setModalCallback] = useState(null);

  useEffect(() => {
    if (carId) {
      loadEvents();
      loadTracks();
    }
  }, [carId]);

  useEffect(() => {
    if (currentEvent) {
      loadSessions(currentEvent.id);
      setShowForm(false);
    }
  }, [currentEvent]);

  useEffect(() => {
    if (currentSession) {
      loadParts(currentSession);
      loadSessionNotes(currentSession);
    }
  }, [currentSession]);

  const loadEvents = async () => {
    try {
      const fetchedEvents = await window.api.getEventsWithSessions();
      const filteredEvents = fetchedEvents.filter(event => event.carId == carId && event.trackId !== 1); // 1 is the ID for the "Garage" track
      setEvents(filteredEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadTracks = async () => {
    try {
      const fetchedTracks = await window.api.getTracks();
      const filteredTracks = fetchedTracks.filter(track => track.id !== 1); // Exclude "Garage" track
      setTracks(filteredTracks);
    } catch (error) {
      console.error('Error loading tracks:', error);
    }
  };

  const loadSessions = async (eventId) => {
    try {
      const fetchedSessions = await window.api.getSessions(eventId);
      setSessions(fetchedSessions);
      if (!currentSession && fetchedSessions.length > 0) {
        setCurrentSession(fetchedSessions[0].id);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadParts = async (sessionId) => {
    try {
      const fetchedParts = await window.api.getParts(carId);
      const partsValues = await window.api.getPartsValues() || [];
      const sessionPartsValues = await window.api.getSessionPartsValuesBySessionId(sessionId) || {};

      const uniqueParts = ensureUniqueOrder(fetchedParts);
      const sortedParts = uniqueParts.sort((a, b) => a.order - b.order);
      setParts(sortedParts);

      const initialValues = {};
      for (const part of sortedParts) {
        const sessionPartValue = sessionPartsValues.values ? sessionPartsValues.values[part.id] : undefined;
        const partValue = partsValues.find(pv => pv.partId == part.id);
        initialValues[part.id] = sessionPartValue !== undefined ? sessionPartValue : (partValue ? partValue.value : '');
      }
      setValues(initialValues);

      groupPartsByLocation(sortedParts);
    } catch (error) {
      console.error('Error loading parts:', error);
    }
  };

  const ensureUniqueOrder = (parts) => {
    const orderMap = new Map();
    let orderValue = 1;

    parts.forEach((part) => {
      const key = `${part.displayLocation}-${part.subheading || 'Others'}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, new Set());
      }
      orderMap.get(key).add(part.order);
    });

    parts.forEach((part) => {
      const key = `${part.displayLocation}-${part.subheading || 'Others'}`;
      while (orderMap.get(key).has(orderValue)) {
        orderValue++;
      }
      if (!part.order || orderMap.get(key).has(part.order)) {
        part.order = orderValue;
        orderMap.get(key).add(orderValue);
      }
      orderValue++;
    });

    parts.forEach((part) => {
      if (!part.order) {
        window.api.updatePartOrder(part.id, part.order);
      }
    });

    return parts;
  };

  const groupPartsByLocation = (parts) => {
    const grouped = parts.reduce((acc, part) => {
      const location = part.displayLocation;
      const subheading = part.subheading?.trim() || 'Others';
      if (!acc[location]) {
        acc[location] = {};
      }
      if (!acc[location][subheading]) {
        acc[location][subheading] = [];
      }
      acc[location][subheading].push(part);
      return acc;
    }, {});
    setGroupedParts(grouped);
  };

  const handleTrackChange = (e) => {
    const trackName = e.target.value;
    setSelectedTrack(trackName);
    setEventName(`Racing at ${trackName}`);
  };

  const handleEventNameChange = (e) => {
    setEventName(e.target.value);
  };

  const handleAddSession = () => {
    if (newSessionName.trim()) {
      setSessions([...sessions, { name: newSessionName.trim() }]);
      setNewSessionName('');
    }
  };

  const handleSessionChange = (session) => {
    setSelectedSessions(prevSelected => {
      if (prevSelected.includes(session.name || session)) {
        return prevSelected.filter(s => s !== (session.name || session));
      } else {
        return [...prevSelected, session.name || session];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let trackId = tracks.find(track => track.name == selectedTrack)?.id;
    if (!trackId) {
      const newTrack = await window.api.addTrack(selectedTrack);
      trackId = newTrack.id;
    }

    const newEvent = await window.api.addEvent(eventName, new Date(eventDate), trackId, carId);
    const eventId = newEvent.id;

    const sessionPromises = selectedSessions.map(session =>
      window.api.addSession(eventId, new Date(), 'track', session)
    );
    const createdSessions = await Promise.all(sessionPromises);

    const preSessionNotesTemplate = [
      { "title": "Starting Position", "type": "Text", "value": "" },
      { "title": "Starting Fuel", "type": "Text", "value": "" },
      { "title": "LF Tire Compound", "type": "Text", "value": "" },
      { "title": "RF Tire Compound", "type": "Text", "value": "" },
      { "title": "LR Tire Compound", "type": "Text", "value": "" },
      { "title": "RR Tire Compound", "type": "Text", "value": "" },
      { "title": "LF Tire Pressure", "type": "Text", "value": "" },
      { "title": "RF Tire Pressure", "type": "Text", "value": "" },
      { "title": "LR Tire Pressure", "type": "Text", "value": "" },
      { "title": "RR Tire Pressure", "type": "Text", "value": "" },
      { "title": "Notes", "type": "Paragraph", "value": "" }
    ];

    const postSessionNotesTemplate = [
      { "title": "Finishing Position", "type": "Text", "value": "" },
      { "title": "Finishing Fuel", "type": "Text", "value": "" },
      { "title": "LF Tire Pressure", "type": "Text", "value": "" },
      { "title": "RF Tire Pressure", "type": "Text", "value": "" },
      { "title": "LR Tire Pressure", "type": "Text", "value": "" },
      { "title": "RR Tire Pressure", "type": "Text", "value": "" },
      { "title": "Notes", "type": "Paragraph", "value": "" },
      { "title": "Driver Feedback", "type": "Paragraph", "value": "" }
    ];

    await Promise.all(
      createdSessions.map(session =>
        Promise.all([
          window.api.addPreSessionNotes(session.id, preSessionNotesTemplate),
          window.api.addPostSessionNotes(session.id, postSessionNotesTemplate)
        ])
      )
    );

    setCurrentEvent(newEvent);
    setCurrentSession(createdSessions[0]?.id);
    setShowForm(false); // Hide the form after submission
    loadEvents(); // Refresh the events list
  };

  const toggleForm = () => {
    setShowForm(!showForm);
  };

  const toggleCustomSessions = () => {
    setShowCustomSessions(!showCustomSessions);
  };

  const handleSessionClick = (sessionId) => {
    setCurrentSession(sessionId);
  };

  const handleEndEvent = () => {
    setCurrentEvent(null);
    setCurrentSession(null);
    loadEvents(); // Refresh the events list
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    contextMenu.show({
      id: 'event-menu',
      event: e,
      props: { item }
    });
  };

  const handleDeleteEvent = async ({ props }) => {
    setIsModalOpen(true);
    setModalCallback(() => async (confirm) => {
      if (confirm) {
        try {
          await window.api.deleteEvent(props.item.id);
          loadEvents();
        } catch (error) {
          console.error('Error deleting event:', error);
        }
      }
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalCallback(null);
  };

  const handleModalOption = async (option) => {
    closeModal();
    if (modalCallback) {
      await modalCallback(option);
    }
  };

  const handleChange = (partId, value) => {
    setValues({ ...values, [partId]: value });
  };

  const handleIncrement = (partId) => {
    setValues({ ...values, [partId]: (values[partId] || 0) + 1 });
  };

  const handleDecrement = (partId) => {
    setValues({ ...values, [partId]: (values[partId] || 0) - 1 });
  };

  const handleTableLinkClick = (part) => {
    setCurrentPart(part);
    setShowTableLightbox(true);
  };

  const handleTableLightboxClose = () => {
    setShowTableLightbox(false);
    setCurrentPart(null);
  };

  const handleSetupSubmit = async () => {
    try {
      // Update all part values
      for (const partId in values) {
        await window.api.updatePartValue(partId, values[partId]);
      }
  
      // Check for existing session parts values
      const existingSessionPartsValues = await window.api.getSessionPartsValuesBySessionId(currentSession) || {};
      if (Object.keys(existingSessionPartsValues).length > 0) {
        await window.api.deleteSessionPartsValuesBySessionId(currentSession);
      }
  
      // Add new session parts values
      await window.api.addSessionPartsValue2(currentSession, values);
  
      // Save notes
      await window.api.updatePreSessionNotes(currentSession, preSessionNotes);
      await window.api.updatePostSessionNotes(currentSession, postSessionNotes);
  
      // Refresh the sessions to ensure data is up-to-date but preserve current session
      await loadSessions(currentEvent.id);
      setCurrentSession(currentSession); // Ensure the selected session remains highlighted
  
      // Show success toast with session and event details
      toast.success(`Parts values for ${sessions.find(s => s.id === currentSession)?.name || 'session'} updated for ${currentEvent.name}`);
    } catch (error) {
      console.error('Error during setup submit:', error);
      toast.error('Failed to update parts values.');
    }
  };

  const loadSessionNotes = async (sessionId) => {
    try {
      const preNotes = await window.api.getPreSessionNotesBySessionId(sessionId);
      const postNotes = await window.api.getPostSessionNotesBySessionId(sessionId);
      setPreSessionNotes(preNotes ? preNotes.notes : []);
      setPostSessionNotes(postNotes ? postNotes.notes : []);
    } catch (error) {
      console.error('Error loading session notes:', error);
    }
  };

  const renderNotesForm = (notes, setNotes) => {
    return notes.map((note, index) => (
      <div className="notes-row" key={index}>
        <div className="notes-label">{note.title}</div>
        <div className="notes-input">
          {note.type === 'Text' ? (
            <input
              type="text"
              value={note.value || ''}
              onChange={(e) => {
                const newNotes = [...notes];
                newNotes[index].value = e.target.value;
                setNotes(newNotes);
              }}
            />
          ) : note.type === 'Paragraph' ? (
            <textarea
              value={note.value || ''}
              onChange={(e) => {
                const newNotes = [...notes];
                newNotes[index].value = e.target.value;
                setNotes(newNotes);
              }}
            />
          ) : null}
        </div>
      </div>
    ));
  };

  const handleShowAll = () => {
    setShowAll(true);
  };

  const handleHideAll = () => {
    setShowAll(false);
  };

  return (
    <div className="trackside">
      <ToastContainer />
      {currentEvent ? (
        <div className="dashboard">
          <div className="left-column">
            <h2>{currentEvent.name}</h2>
            <ul>
              {sessions.map((session, index) => (
                <li
                  key={index}
                  className={session.id == currentSession ? 'selected' : ''}
                  onClick={() => handleSessionClick(session.id)}
                >
                  {session.name || session}
                </li>
              ))}
            </ul>
            <button onClick={handleEndEvent}>End Event</button>
          </div>
          <div className="right-column">
            <div className="box">
              <h2>Pre-Session Notes</h2>
              {renderNotesForm(preSessionNotes, setPreSessionNotes)}
            </div>
            <div className="box">
              <h2>Setup</h2>
              <div className="search-controls">
                <input
                  type="text"
                  placeholder="Search Parts"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  className={showAll ? 'active' : ''}
                  onClick={handleShowAll}
                >
                  Show All
                </button>
                <button
                  className={!showAll ? 'active' : ''}
                  onClick={handleHideAll}
                >
                  Hide All
                </button>
              </div>
              <PartsGrid
                gridLayout={gridLayout}
                groupedParts={groupedParts}
                values={values}
                handleChange={handleChange}
                handleIncrement={handleIncrement}
                handleDecrement={handleDecrement}
                handleTableLinkClick={handleTableLinkClick}
                showAll={showAll}
                searchTerm={searchTerm}
              />
            </div>
            <div className="box">
              <h2>Post-Session Notes</h2>
              {renderNotesForm(postSessionNotes, setPostSessionNotes)}
            </div>
            <button className="save-notes" onClick={handleSetupSubmit}>Save Notes</button>
          </div>
        </div>
      ) : (
        <>
          <h2>Trackside Events</h2>
          {events.length > 0 ? (
            <ul>
              {events.map((event, index) => (
                <li key={index} onClick={() => setCurrentEvent(event)} onContextMenu={(e) => handleContextMenu(e, event)}>
                  {event.name} - {new Date(event.date).toLocaleDateString()}
                </li>
              ))}
            </ul>
          ) : (
            <p>No trackside events available. Create a new event.</p>
          )}
          <button onClick={toggleForm}>{showForm ? 'Cancel' : 'Create New Event'}</button>

          {showForm && (
            <div className="create-event">
              <h2>Create Event</h2>
              <form onSubmit={handleSubmit}>
                <label>
                  Track Name:
                  <input
                    type="text"
                    list="track-options"
                    value={selectedTrack}
                    onChange={handleTrackChange}
                    required
                  />
                  <datalist id="track-options">
                    {tracks.map((track, index) => (
                      <option key={index} value={track.name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Event Name:
                  <input
                    type="text"
                    value={eventName}
                    onChange={handleEventNameChange}
                  />
                </label>
                <label>
                  Event Date:
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Sessions:
                  <div>
                    {['Practice', 'Heat', 'Feature'].map((session, index) => (
                      <div key={index}>
                        <input
                          type="checkbox"
                          id={`session-${index}`}
                          value={session}
                          onChange={() => handleSessionChange(session)}
                          checked={selectedSessions.includes(session)}
                        />
                        <label htmlFor={`session-${index}`}>{session}</label>
                      </div>
                    ))}
                    {sessions.map((session, index) => (
                      <div key={index}>
                        <input
                          type="checkbox"
                          id={`session-${index + 3}`}
                          value={session.name || session}
                          onChange={() => handleSessionChange(session.name || session)}
                          checked={selectedSessions.includes(session.name || session)}
                        />
                        <label htmlFor={`session-${index + 3}`}>{session.name || session}</label>
                      </div>
                    ))}
                  </div>
                </label>
                <button type="button" onClick={toggleCustomSessions}>Add Custom Sessions</button>
                {showCustomSessions && (
                  <div>
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                    />
                    <button type="button" onClick={handleAddSession}>+</button>
                  </div>
                )}
                <button type="submit">Submit</button>
              </form>
            </div>
          )}
        </>
      )}
      {showTableLightbox && (
        <div className="lightbox">
          <div className="lightbox-content">
            <h2>{currentPart.name} Table</h2>
            <EditableTable
              value={values[currentPart.id]}
              onChange={(newValue) => handleChange(currentPart.id, newValue)}
            />
            <button onClick={handleTableLightboxClose}>Close</button>
          </div>
        </div>
      )}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Confirm Deletion"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Confirm Deletion</h2>
        <p>Are you sure you want to delete this event? This action cannot be undone and will remove all associated sessions and data.</p>
        <button onClick={() => handleModalOption(true)}>Yes</button>
        <button onClick={() => handleModalOption(false)}>No</button>
      </Modal>
      <Menu id="event-menu">
        <Item onClick={handleDeleteEvent}>Delete Event</Item>
      </Menu>
    </div>
  );
};

export default Trackside;
