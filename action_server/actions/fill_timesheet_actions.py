from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher

class ActionManage(Action):

    def name(self) -> Text:
        return "action_manage"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        response_name = "utter_fill_timesheet"
        
        dispatcher.utter_message(response=response_name)

        return
