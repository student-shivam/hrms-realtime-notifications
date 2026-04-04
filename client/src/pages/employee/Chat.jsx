import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { ASSET_BASE_URL, getApiErrorMessage } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import './Employee.css';

const EMOJIS = ['😀', '😁', '😂', '😊', '😍', '😎', '👍', '🙏', '🎉', '🔥', '💼', '📎', '✅', '❤️'];

const formatPreviewTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const toKey = (item) => new Date(item).toDateString();
  if (toKey(date) === toKey(today)) return 'Today';
  if (toKey(date) === toKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

const toMessageStatus = (message) => {
  if (message.deletedForEveryone) return '';
  if (message.status === 'seen') return '✓✓';
  if (message.status === 'delivered') return '✓✓';
  return '✓';
};

const getConversationTitle = (conversation) => {
  if (!conversation) return '';
  return conversation.name;
};

const getConversationSubtitle = (conversation, onlineUsers, typingState) => {
  if (!conversation) return '';

  const typingKey = `${conversation.type}:${conversation._id}`;
  if (typingState[typingKey]) {
    return typingState[typingKey];
  }

  if (conversation.type === 'group') {
    return `${conversation.participants?.length || 0} participants`;
  }

  return onlineUsers.includes(String(conversation._id)) ? 'Online' : (conversation.role || conversation.subtitle || 'Offline');
};

const Chat = () => {
  const { user } = useSelector((state) => state.auth);
  const { socket } = useSocket() || {};
  const [directChats, setDirectChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [typingState, setTypingState] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingText, setEditingText] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', department: '', memberIds: [] });
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentUserId = user?._id || user?.id;

  const fetchBootstrap = async (preserveSelection = true) => {
    try {
      const res = await api.get('/chat/bootstrap');
      const nextDirectChats = res.data.data.directChats || [];
      const nextGroups = res.data.data.groups || [];
      const nextOnlineUsers = res.data.data.onlineUsers || [];

      setDirectChats(nextDirectChats);
      setGroups(nextGroups);
      setOnlineUsers(nextOnlineUsers);

      if (preserveSelection && selectedConversation) {
        const merged = [...nextDirectChats, ...nextGroups];
        const matched = merged.find((item) => item.type === selectedConversation.type && String(item._id) === String(selectedConversation._id));
        if (matched) {
          setSelectedConversation(matched);
        }
      }
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to load chats'));
    } finally {
      setLoading(false);
    }
  };

  const fetchConversation = async (conversation) => {
    if (!conversation) return;

    try {
      const endpoint = conversation.type === 'group'
        ? `/chat/group/${conversation._id}`
        : `/chat/direct/${conversation._id}`;
      const res = await api.get(endpoint);
      setMessages(res.data.data || []);
      setStatusMsg('');
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to load conversation'));
    }
  };

  useEffect(() => {
    fetchBootstrap(false);
  }, []);

  useEffect(() => {
    if (!selectedConversation?._id) return;
    fetchConversation(selectedConversation);
  }, [selectedConversation?._id, selectedConversation?.type]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedConversation, typingState]);

  const markSeen = async (conversation) => {
    if (!conversation) return;
    try {
      await api.put(`/chat/seen/${conversation.type}/${conversation._id}`);
    } catch (error) {
      // keep UI responsive even if seen sync fails
    }
  };

  useEffect(() => {
    if (selectedConversation?._id) {
      markSeen(selectedConversation);
    }
  }, [selectedConversation?._id, selectedConversation?.type]);

  useEffect(() => {
    if (!socket || !currentUserId) return undefined;

    const upsertMessage = (incoming) => {
      setMessages((prev) => {
        if (!selectedConversation) return prev;

        const belongsToOpenDirect = selectedConversation.type === 'direct'
          && incoming.groupId == null
          && (
            String(incoming.senderId) === String(selectedConversation._id)
            || String(incoming.receiverId) === String(selectedConversation._id)
          );

        const belongsToOpenGroup = selectedConversation.type === 'group'
          && String(incoming.groupId) === String(selectedConversation._id);

        if (!belongsToOpenDirect && !belongsToOpenGroup) {
          return prev;
        }

        if (prev.some((item) => String(item._id) === String(incoming._id))) {
          return prev.map((item) => String(item._id) === String(incoming._id) ? { ...item, ...incoming } : item);
        }

        return [...prev, incoming];
      });
    };

    const handleReceiveMessage = (incoming) => {
      upsertMessage(incoming);
      fetchBootstrap();

      const isOpenConversation = selectedConversation && (
        (selectedConversation.type === 'group' && String(incoming.groupId) === String(selectedConversation._id))
        || (selectedConversation.type === 'direct' && incoming.groupId == null && (
          String(incoming.senderId) === String(selectedConversation._id)
          || String(incoming.receiverId) === String(selectedConversation._id)
        ))
      );

      if (isOpenConversation && String(incoming.senderId) !== String(currentUserId)) {
        socket.emit('messageSeen', {
          byUserId: currentUserId,
          targetType: selectedConversation.type,
          targetId: selectedConversation._id
        });
        markSeen(selectedConversation);
      }
    };

    const handleMessageStatusUpdated = ({ messageId, status }) => {
      setMessages((prev) => prev.map((item) => (
        String(item._id) === String(messageId) ? { ...item, status } : item
      )));
      fetchBootstrap();
    };

    const handleMessageSeen = ({ messageIds, byUserId }) => {
      if (!Array.isArray(messageIds)) return;
      setMessages((prev) => prev.map((item) => (
        messageIds.includes(String(item._id))
          ? {
              ...item,
              status: 'seen',
              seenBy: Array.from(new Set([...(item.seenBy || []), String(byUserId)]))
            }
          : item
      )));
      fetchBootstrap();
    };

    const handleMessageUpdated = (updatedMessage) => {
      setMessages((prev) => prev.map((item) => (
        String(item._id) === String(updatedMessage._id) ? { ...item, ...updatedMessage } : item
      )));
      fetchBootstrap();
    };

    const handleMessageDeleted = ({ messageId, scope, userId: affectedUserId, deletedForEveryone }) => {
      setMessages((prev) => {
        if (scope === 'everyone' || deletedForEveryone) {
          return prev.map((item) => (
            String(item._id) === String(messageId)
              ? { ...item, deletedForEveryone: true, messageText: 'This message was deleted', fileUrl: '', originalFileName: '', messageType: 'text' }
              : item
          ));
        }

        if (String(affectedUserId) === String(currentUserId)) {
          return prev.filter((item) => String(item._id) !== String(messageId));
        }

        return prev;
      });
      fetchBootstrap();
    };

    const handleTyping = ({ fromUserId, targetType, targetId, isTyping }) => {
      if (!selectedConversation) return;

      const key = `${targetType}:${targetId}`;
      const matches = selectedConversation.type === targetType && String(selectedConversation._id) === String(targetId);
      if (!matches || String(fromUserId) === String(currentUserId)) return;

      setTypingState((prev) => {
        const next = { ...prev };
        if (isTyping) {
          const sender = [...directChats, ...groups].find((item) => String(item._id) === String(fromUserId));
          next[key] = sender?.name ? `${sender.name} is typing...` : 'Typing...';
        } else {
          delete next[key];
        }
        return next;
      });
    };

    const handleSidebarUpdated = ({ directChats: nextDirect, groups: nextGroups }) => {
      if (nextDirect) setDirectChats(nextDirect);
      if (nextGroups) setGroups(nextGroups);
    };

    const handleUserOnline = ({ onlineUsers: nextOnline, userId: onlineUserId }) => {
      if (Array.isArray(nextOnline)) {
        setOnlineUsers(nextOnline.map(String));
      } else if (onlineUserId) {
        setOnlineUsers((prev) => Array.from(new Set([...prev, String(onlineUserId)])));
      }
    };

    const handleUserOffline = ({ onlineUsers: nextOnline, userId: offlineUserId }) => {
      if (Array.isArray(nextOnline)) {
        setOnlineUsers(nextOnline.map(String));
      } else if (offlineUserId) {
        setOnlineUsers((prev) => prev.filter((item) => String(item) !== String(offlineUserId)));
      }
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messageStatusUpdated', handleMessageStatusUpdated);
    socket.on('messageSeen', handleMessageSeen);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('typing', handleTyping);
    socket.on('chatSidebarUpdated', handleSidebarUpdated);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messageStatusUpdated', handleMessageStatusUpdated);
      socket.off('messageSeen', handleMessageSeen);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('typing', handleTyping);
      socket.off('chatSidebarUpdated', handleSidebarUpdated);
      socket.off('userOnline', handleUserOnline);
      socket.off('userOffline', handleUserOffline);
    };
  }, [socket, currentUserId, selectedConversation, directChats, groups]);

  const emitTyping = (isTyping) => {
    if (!socket || !selectedConversation?._id) return;
    socket.emit('typing', {
      fromUserId: currentUserId,
      targetType: selectedConversation.type,
      targetId: selectedConversation._id,
      isTyping
    });
  };

  const handleInputChange = (event) => {
    const nextValue = event.target.value;
    setMessageText(nextValue);
    emitTyping(nextValue.trim().length > 0);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1000);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!selectedConversation?._id || (!messageText.trim() && !selectedFile)) return;

    setSending(true);
    try {
      const formData = new FormData();
      if (selectedConversation.type === 'group') {
        formData.append('groupId', selectedConversation._id);
      } else {
        formData.append('receiverId', selectedConversation._id);
      }
      formData.append('messageText', messageText.trim());
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const res = await api.post('/chat/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessages((prev) => [...prev, res.data.data]);
      setMessageText('');
      setSelectedFile(null);
      setShowEmojiPicker(false);
      setStatusMsg('');
      emitTyping(false);
      fetchBootstrap();
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleEditSubmit = async (messageId) => {
    try {
      const res = await api.put(`/chat/edit/${messageId}`, { messageText: editingText });
      setMessages((prev) => prev.map((item) => String(item._id) === String(messageId) ? res.data.data : item));
      setEditingMessageId('');
      setEditingText('');
      fetchBootstrap();
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to edit message'));
    }
  };

  const handleDelete = async (messageId, scope) => {
    try {
      await api.delete(`/chat/delete/${messageId}?scope=${scope}`);
      if (scope === 'me') {
        setMessages((prev) => prev.filter((item) => String(item._id) !== String(messageId)));
      } else {
        setMessages((prev) => prev.map((item) => (
          String(item._id) === String(messageId)
            ? { ...item, deletedForEveryone: true, messageText: 'This message was deleted', fileUrl: '', originalFileName: '', messageType: 'text' }
            : item
        )));
      }
      fetchBootstrap();
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to delete message'));
    }
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    try {
      await api.post('/chat/groups', groupForm);
      setShowGroupModal(false);
      setGroupForm({ name: '', department: '', memberIds: [] });
      fetchBootstrap(false);
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Failed to create group'));
    }
  };

  const renderAttachment = (item) => {
    if (!item.fileUrl) return null;

    const fullUrl = `${ASSET_BASE_URL}${item.fileUrl}`;

    if (item.messageType === 'image') {
      return (
        <a href={fullUrl} target="_blank" rel="noreferrer" className="chat-image-link">
          <img src={fullUrl} alt={item.originalFileName || 'attachment'} className="chat-image-preview" />
        </a>
      );
    }

    return (
      <a href={fullUrl} target="_blank" rel="noreferrer" className="chat-file-chip">
        <span>📄</span>
        <strong>{item.originalFileName || 'Download file'}</strong>
      </a>
    );
  };

  const renderMessages = () => {
    let lastDay = '';

    return messages.map((item) => {
      const dayLabel = formatDayLabel(item.createdAt);
      const showDaySeparator = dayLabel !== lastDay;
      lastDay = dayLabel;
      const own = String(item.senderId) === String(currentUserId);
      const canDeleteForEveryone = own && (Date.now() - new Date(item.createdAt).getTime() <= 10 * 60 * 1000);

      return (
        <React.Fragment key={item._id}>
          {showDaySeparator ? <div className="chat-day-separator"><span>{dayLabel}</span></div> : null}
          <div className={`message-row ${own ? 'sent' : 'received'}`}>
            <div className={`message-bubble ${own ? 'sent' : 'received'}`}>
              {selectedConversation?.type === 'group' && !own ? (
                <span className="message-sender-name">
                  {selectedConversation.participants?.find((member) => String(member._id) === String(item.senderId))?.name || 'Member'}
                </span>
              ) : null}

              {editingMessageId === item._id ? (
                <div className="chat-edit-box">
                  <input value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                  <div className="chat-edit-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingMessageId('')}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleEditSubmit(item._id)}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  {item.messageText ? <p>{item.messageText}</p> : null}
                  {renderAttachment(item)}
                </>
              )}

              {item.edited && !item.deletedForEveryone ? <span className="message-edited-label">edited</span> : null}

              <div className="message-meta">
                <span className="time">{formatPreviewTime(item.createdAt)}</span>
                {own ? (
                  <span className={`message-status ${item.status || 'sent'}`}>{toMessageStatus(item)}</span>
                ) : null}
              </div>

              {own && editingMessageId !== item._id && !item.deletedForEveryone ? (
                <div className="message-actions">
                  {item.messageType === 'text' ? (
                    <button type="button" onClick={() => { setEditingMessageId(item._id); setEditingText(item.messageText); }}>Edit</button>
                  ) : null}
                  <button type="button" onClick={() => handleDelete(item._id, 'me')}>Delete Me</button>
                  {canDeleteForEveryone ? <button type="button" onClick={() => handleDelete(item._id, 'everyone')}>Delete All</button> : null}
                </div>
              ) : null}
            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  const mergedSidebar = [
    ...directChats,
    ...groups
  ];

  return (
    <div className="animate-fade-in employee-page chat-layout chat-pro-layout">
      <div className="glass-panel chat-sidebar">
        <div className="chat-panel-heading">
          <div>
            <h3>Messages</h3>
            <p>{loading ? 'Loading conversations...' : `${mergedSidebar.length} active chats`}</p>
          </div>
          {user?.role === 'admin' ? (
            <button type="button" className="chat-create-group-btn" onClick={() => setShowGroupModal(true)}>+ Group</button>
          ) : null}
        </div>

        <div className="chat-section-label">Direct Messages</div>
        <div className="user-list">
          {loading ? (
            <div className="text-center py-6"><div className="spinner"></div></div>
          ) : (
            <>
              {directChats.map((chatUser) => (
                <div
                  key={`direct-${chatUser._id}`}
                  className={`user-item ${selectedConversation?.type === 'direct' && selectedConversation?._id === chatUser._id ? 'active' : ''}`}
                  onClick={() => setSelectedConversation(chatUser)}
                >
                  <div className="chat-user-row">
                    <div className="chat-avatar-stack">
                      <div className={`chat-avatar-dot ${onlineUsers.includes(String(chatUser._id)) ? 'online' : ''}`}></div>
                      <div className="chat-avatar-circle">{chatUser.name?.charAt(0) || 'U'}</div>
                    </div>
                    <div className="chat-user-copy">
                      <strong>{chatUser.name}</strong>
                      <span>{onlineUsers.includes(String(chatUser._id)) ? 'Online' : (chatUser.role || 'Offline')}</span>
                    </div>
                    {chatUser.unreadCount > 0 ? <span className="chat-unread-badge">{chatUser.unreadCount}</span> : null}
                  </div>
                  <div className="chat-preview-row">
                    <p className="chat-preview">{chatUser.lastMessage?.messageText || chatUser.lastMessage?.originalFileName || 'Start a conversation'}</p>
                    <span className="chat-preview-time">{formatPreviewTime(chatUser.lastMessage?.createdAt || chatUser.lastMessage?.timestamp)}</span>
                  </div>
                </div>
              ))}

              <div className="chat-section-label">Groups</div>
              {groups.map((group) => (
                <div
                  key={`group-${group._id}`}
                  className={`user-item ${selectedConversation?.type === 'group' && selectedConversation?._id === group._id ? 'active' : ''}`}
                  onClick={() => setSelectedConversation(group)}
                >
                  <div className="chat-user-row">
                    <div className="chat-avatar-circle chat-group-circle">#</div>
                    <div className="chat-user-copy">
                      <strong>{group.name}</strong>
                      <span>{group.department || `${group.participants?.length || 0} members`}</span>
                    </div>
                    {group.unreadCount > 0 ? <span className="chat-unread-badge">{group.unreadCount}</span> : null}
                  </div>
                  <div className="chat-preview-row">
                    <p className="chat-preview">{group.lastMessage?.messageText || group.lastMessage?.originalFileName || 'No messages yet'}</p>
                    <span className="chat-preview-time">{formatPreviewTime(group.lastMessage?.createdAt || group.lastMessage?.timestamp)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="glass-panel chat-main">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <div>
                <h3>{getConversationTitle(selectedConversation)}</h3>
                <span className="text-muted">{getConversationSubtitle(selectedConversation, onlineUsers, typingState)}</span>
              </div>
              <div className="chat-header-badge">
                {selectedConversation.type === 'group' ? 'Group Chat' : 'Private Chat'}
              </div>
            </div>

            <div className="chat-messages">
              {statusMsg ? <div className="status-msg error">{statusMsg}</div> : null}
              {renderMessages()}
              <div ref={chatEndRef} />
            </div>

            {selectedFile ? (
              <div className="chat-attachment-bar">
                <span>Attached: {selectedFile.name}</span>
                <button type="button" onClick={() => setSelectedFile(null)}>Remove</button>
              </div>
            ) : null}

            {showEmojiPicker ? (
              <div className="chat-emoji-panel">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setMessageText((prev) => `${prev}${emoji}`)}>
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}

            <form className="chat-input chat-rich-input" onSubmit={handleSend}>
              <div className="chat-input-actions">
                <button type="button" className="chat-tool-btn" onClick={() => setShowEmojiPicker((prev) => !prev)}>😊</button>
                <button type="button" className="chat-tool-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <input
                type="text"
                placeholder={selectedConversation.type === 'group' ? 'Message the group...' : 'Type a message...'}
                value={messageText}
                onChange={handleInputChange}
              />

              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat text-center py-20">
            <div className="empty-chat-card">
              <h3>Choose a chat to start talking</h3>
              <p className="text-muted">Private HR chats, department rooms, files, emojis, edits, and real-time updates all live here.</p>
            </div>
          </div>
        )}
      </div>

      {showGroupModal ? (
        <div className="calendar-modal-backdrop" onClick={() => setShowGroupModal(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <div>
                <h3>Create Department Group</h3>
                <p>Build a shared space for HR and team members.</p>
              </div>
              <button type="button" className="calendar-modal-close" onClick={() => setShowGroupModal(false)}>×</button>
            </div>
            <form className="calendar-modal-body" onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group Name</label>
                <input value={groupForm.name} onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input value={groupForm.department} onChange={(e) => setGroupForm((prev) => ({ ...prev, department: e.target.value }))} placeholder="Engineering / HR / Sales" />
              </div>
              <div className="form-group">
                <label>Members</label>
                <div className="chat-group-members">
                  {directChats.map((member) => (
                    <label key={member._id} className="chat-group-member-option">
                      <input
                        type="checkbox"
                        checked={groupForm.memberIds.includes(member._id)}
                        onChange={(e) => setGroupForm((prev) => ({
                          ...prev,
                          memberIds: e.target.checked
                            ? [...prev.memberIds, member._id]
                            : prev.memberIds.filter((id) => id !== member._id)
                        }))}
                      />
                      <span>{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Chat;
