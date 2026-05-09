using System;
using SQLite;

namespace QuestJournal.SQLData
{
    [Table("QuestProgress")]
    public record QuestProgressData(
        int Id,
        bool Enabled,
        long InputDate,
        [property: Column("quest_id"), Indexed] int QuestId,
        [property: Column("is_complete")] bool IsComplete = false
    ) : SQLiteData(Id, Enabled, InputDate)
    {
        public QuestProgressData() : this(0, true, DateTime.Now.Ticks, 0) { }
    }
}