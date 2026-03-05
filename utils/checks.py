import discord
import db as database

async def has_command_permission(interaction: discord.Interaction) -> bool:
    """Check if the user has permission to run the current command."""
    if not interaction.guild:
        return True # DMs usually don't have role restrictions in this context
        
    if interaction.user.guild_permissions.administrator:
        return True
        
    command_name = interaction.command.name.lower()
    guild_id = str(interaction.guild_id)
    
    db = await database.get_db()
    cursor = await db.execute(
        "SELECT role_id FROM command_permissions WHERE command_name = ? AND guild_id = ?",
        (command_name, guild_id)
    )
    rows = await cursor.fetchall()
    
    if not rows:
        return True # No restrictions
        
    user_role_ids = [str(role.id) for role in interaction.user.roles]
    for row in rows:
        if row['role_id'] in user_role_ids:
            return True
            
    await interaction.response.send_message("You don't have the required role to use this command.", ephemeral=True)
    return False
