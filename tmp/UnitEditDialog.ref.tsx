import React, { useEffect, useState } from 'react';
import { Box, Dialog, Grid, Switch, FormGroup, FormControlLabel, FormControl, FormLabel } from '@mui/material';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

const Save = require('../save');

interface UnitEditDialogProps {
  devnickname: string;
  characterId: string;
  code: string;
  ownedunits: Record<string, string>;
  userlist: {
    data: {
      user_character_list: Record<string, any>;
    };
  },
  mb2: boolean;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
  }

export default function UnitEditDialog({ devnickname, code, ownedunits, userlist, mb2 }: UnitEditDialogProps) {
    const [open, setOpen] = useState(false);
    const [unitOwned, setUnitOwned] = useState(false);
    const [tabValue, setTabValue] = useState('1');

    const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
        setTabValue(newValue);
    }
    
    const initialAbilities = mb2 ? [[], [], [], [], [], []] : [[], [], []];
    const [abilities, setAbilities] = useState<number[][]>(initialAbilities);

    const abiList = mb2 ? ["abi1", "abi2", "abi3", "abi4", "abi5", "abi6"] : ["abi1", "abi2", "abi3"];
    
    const handleAbilityChange = (
        index: number,
        event: React.MouseEvent<HTMLElement>,
        newAbility: number[],
    ) => {
        if (newAbility.length > 0) {
            const clickedNumber = newAbility[newAbility.length - 1];
            const clickedLevel = Number(event.currentTarget.getAttribute('value'));
            let updatedAbilities = [...abilities];

            if (clickedNumber > Math.max(...updatedAbilities[index], -1)) {
                updatedAbilities[index] = Array.from({ length: clickedNumber + 1 }, (_, i) => i);
            } else {
                if (clickedLevel === 5) {
                    updatedAbilities[index] = [];
                } else {
                    updatedAbilities[index] = Array.from({ length: clickedLevel + 1 }, (_, i) => i);
                }
            }
            setAbilities(updatedAbilities);
        } else {
            setAbilities(prev => {
                const updated = [...prev];
                updated[index] = [];
                return updated;
            });
        }
    };

    useEffect(() => {
        setUnitOwned(devnickname in ownedunits);
    }, [devnickname, ownedunits]);

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleUnitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("Unit Change: ", e.target.checked);
        if (e.target.checked) {
            try {
                console.log("Adding character: ", code, userlist);
                Save.addCharacter(code, userlist);
                setUnitOwned(true);
            } catch (error) {
                console.error(error);
            }
        } else {
            // Logic for removing the character can be added here if needed
            setUnitOwned(false);
        }
    };

    Save.editManaboard(code, {
        "id": "abi2",
        "level": 1
    }, userlist);

    return (
        <div>
            <img
                style={{
                    display: 'flex',
                    width: '56px',
                    height: '56px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '3px',
                    margin: '2px',
                    border: '3px solid #000',
                    boxShadow: '0 0 1px 1px 0 #000',
                    backgroundColor: unitOwned ? '#FFF' : '#000',
                    filter: unitOwned ? 'none' : 'brightness(50%)'
                }}
                src={`https://eliya-bot.herokuapp.com/img/assets/chars/${devnickname}/square_0.png`}
                alt={devnickname}
                onClick={handleOpen}
            />
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth={false}
            >
                <Box style={{
                    padding: '20px',
                    width: '50vw',
                    maxWidth: '820px',
                    margin: '0 auto'
                }}>
                    <Grid container direction="row" justifyContent="center" alignItems="center">
                        <Grid item style={{ margin: '10px' }}>
                            <img src={`https://eliya-bot.herokuapp.com/img/assets/chars/${devnickname}/square_0.png`} alt={devnickname} style={{ width: '100px' }} />
                        </Grid>
                        <Grid item>
                            <Grid container direction="column" justifyContent="center" alignItems="center">
                                <Grid item>
                                    <FormControl component="fieldset">
                                        <FormLabel component="legend">Add Character</FormLabel>
                                        <FormGroup>
                                            <FormControlLabel
                                                control={<Switch checked={unitOwned} onChange={handleUnitChange} name="owned" />}
                                                label="Owned"
                                            />
                                        </FormGroup>
                                    </FormControl>
                                </Grid>
                                <Grid item>char devname: {devnickname}</Grid>
                                <Grid item>Char id: {code}</Grid>
                                <Grid item>has mb2? {mb2 ? "Yes" : "No"}</Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                    <TabContext value={tabValue}>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <TabList onChange={handleTabChange} aria-label="lab API tabs example" centered>
                                <Tab label="Abilities" value="1" />
                                <Tab label="EX Boost" value="2" />
                            </TabList>
                        <TabPanel value="1">
                    {abiList.map((abi, index) => (
                        <div key={abi}>
                            abi: {abi}
                            <ToggleButtonGroup
                                value={abilities[index]}
                                onChange={(event, newAbility) => handleAbilityChange(index, event, newAbility)}
                                >
                                {
                                    Array.from(Array(6), (_, idx) => (
                                        <ToggleButton
                                        key={idx}
                                        value={idx}
                                        aria-label={`ability-${idx}`}
                                        style={{ width: '50px', height: '50px' }}
                                        >
                                            {idx}
                                        </ToggleButton>
                                    ))
                                }
                            </ToggleButtonGroup>
                        </div>
                    ))}
                    </TabPanel>
                    <TabPanel value="2">
                        <div>EX Boost</div>
                    </TabPanel>
                    </Box>
                    </TabContext>
                </Box>
            </Dialog>
        </div>
    );
}
